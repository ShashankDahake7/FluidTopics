'use client';

/**
 * useDesigner.js
 * Central state manager for the Portal Designer.
 *
 * Built on useReducer for predictable, testable state transitions.
 * All tree mutations go through treeUtils so the tree stays immutable.
 *
 * Usage:
 *   const designer = useDesigner();
 *   designer.selectNode('abc123');
 *   designer.updateNodeProps('abc123', { label: 'New Label' });
 *   ...
 */

import { useReducer, useEffect, useCallback, useMemo } from 'react';

import {
  findNode,
  findParent,
  updateNode,
  removeNode,
  insertAt,
  moveNode,
  cloneNode,
  flattenTree,
} from './treeUtils.js';

import { createNode } from './registry.js';

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const INITIAL_STATE = {
  page:             null,       // full page object from API
  tree:             null,       // component tree (working copy)
  theme:            {},         // theme config object
  selectedId:       null,       // selected node id
  hoveredId:        null,
  dragSource:       null,       // { kind:'new', componentType } | { kind:'move', nodeId }
  dragTarget:       null,       // { parentId, index }
  sidebarTab:       'components', // 'components'|'settings'|'styles'|'dom'
  breakpoint:       'desktop',
  history:          [],         // array of tree snapshots for undo
  historyIndex:     -1,
  contextMenu:      null,       // { x, y, nodeId }
  showThemeEditor:  false,
  showCodeEditor:   null,       // nodeId | null
  showExportImport: false,
  clipboard:        null,       // cloned node
  dirty:            false,
  saving:           false,
};

// ---------------------------------------------------------------------------
// History helpers
// ---------------------------------------------------------------------------

/** Push the current tree snapshot onto the history stack, trimming any redo future. */
function pushHistory(state, newTree) {
  // Discard everything after the current cursor (forward redo history)
  const trimmed = state.history.slice(0, state.historyIndex + 1);
  // Keep at most 100 snapshots to avoid memory bloat
  const capped = trimmed.length >= 100 ? trimmed.slice(1) : trimmed;
  return {
    history:      [...capped, newTree],
    historyIndex: capped.length,   // points at the snapshot we just pushed
  };
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function designerReducer(state, action) {
  switch (action.type) {

    // -----------------------------------------------------------------------
    case 'LOAD_PAGE': {
      const { page, tree, theme } = action.payload;
      return {
        ...INITIAL_STATE,
        page,
        tree:         tree ?? null,
        theme:        theme ?? {},
        // Seed history with the initial tree so UNDO works from the start
        history:      tree ? [tree] : [],
        historyIndex: tree ? 0 : -1,
        dirty:        false,
        saving:       false,
      };
    }

    // -----------------------------------------------------------------------
    case 'SELECT_NODE': {
      const { id } = action.payload;
      return {
        ...state,
        selectedId:  id,
        sidebarTab:  id ? 'settings' : state.sidebarTab,
        contextMenu: null,
      };
    }

    // -----------------------------------------------------------------------
    case 'HOVER_NODE': {
      return { ...state, hoveredId: action.payload.id };
    }

    // -----------------------------------------------------------------------
    case 'SET_DRAG_SOURCE': {
      return { ...state, dragSource: action.payload.dragSource };
    }

    case 'SET_DRAG_TARGET': {
      return { ...state, dragTarget: action.payload.dragTarget };
    }

    case 'CLEAR_DRAG': {
      return { ...state, dragSource: null, dragTarget: null };
    }

    // -----------------------------------------------------------------------
    case 'DROP_NODE': {
      const { dragSource, dragTarget } = action.payload;
      if (!dragSource || !dragTarget) return state;
      if (!state.tree) return state;

      let newTree;

      if (dragSource.kind === 'new') {
        // Create a brand-new node from the registry and insert it
        const newNode = createNode(dragSource.componentType);
        newTree = insertAt(state.tree, dragTarget.parentId, dragTarget.index, newNode);
      } else if (dragSource.kind === 'move') {
        // Reposition an existing node
        newTree = moveNode(state.tree, dragSource.nodeId, dragTarget.parentId, dragTarget.index);
      } else {
        return state;
      }

      const hist = pushHistory(state, newTree);
      return {
        ...state,
        tree:         newTree,
        dragSource:   null,
        dragTarget:   null,
        dirty:        true,
        ...hist,
      };
    }

    // -----------------------------------------------------------------------
    case 'UPDATE_NODE_PROPS': {
      const { id, props } = action.payload;
      if (!state.tree) return state;

      const newTree = updateNode(state.tree, id, (node) => ({
        ...node,
        props: { ...node.props, ...props },
      }));

      const hist = pushHistory(state, newTree);
      return { ...state, tree: newTree, dirty: true, ...hist };
    }

    // -----------------------------------------------------------------------
    case 'UPDATE_NODE_STYLE': {
      // styleState is one of: 'base' | 'hover' | 'focus' | 'active'
      const { id, styleState, style } = action.payload;
      if (!state.tree) return state;

      const newTree = updateNode(state.tree, id, (node) => ({
        ...node,
        style: {
          ...node.style,
          [styleState]: { ...(node.style?.[styleState] ?? {}), ...style },
        },
      }));

      const hist = pushHistory(state, newTree);
      return { ...state, tree: newTree, dirty: true, ...hist };
    }

    // -----------------------------------------------------------------------
    case 'UPDATE_NODE_LABEL': {
      const { id, label } = action.payload;
      if (!state.tree) return state;

      const newTree = updateNode(state.tree, id, (node) => ({ ...node, label }));
      const hist = pushHistory(state, newTree);
      return { ...state, tree: newTree, dirty: true, ...hist };
    }

    // -----------------------------------------------------------------------
    case 'UPDATE_NODE_VISIBILITY': {
      const { id, visibility } = action.payload;
      if (!state.tree) return state;

      const newTree = updateNode(state.tree, id, (node) => ({
        ...node,
        visibility: { ...node.visibility, ...visibility },
      }));

      const hist = pushHistory(state, newTree);
      return { ...state, tree: newTree, dirty: true, ...hist };
    }

    // -----------------------------------------------------------------------
    case 'DELETE_NODE': {
      const { id } = action.payload;
      if (!state.tree) return state;

      const newTree = removeNode(state.tree, id);
      const hist = pushHistory(state, newTree);
      return {
        ...state,
        tree:       newTree,
        selectedId: state.selectedId === id ? null : state.selectedId,
        dirty:      true,
        ...hist,
      };
    }

    // -----------------------------------------------------------------------
    case 'DUPLICATE_NODE': {
      const { id } = action.payload;
      if (!state.tree) return state;

      const original = findNode(state.tree, id);
      if (!original) return state;

      const clone = cloneNode(original);
      const parentInfo = findParent(state.tree, id);
      if (!parentInfo) return state;

      // Insert clone immediately after the original
      const newTree = insertAt(
        state.tree,
        parentInfo.parent.id,
        parentInfo.index + 1,
        clone,
      );

      const hist = pushHistory(state, newTree);
      return { ...state, tree: newTree, dirty: true, ...hist };
    }

    // -----------------------------------------------------------------------
    case 'COPY_NODE': {
      const { id } = action.payload;
      if (!state.tree) return state;

      const node = findNode(state.tree, id);
      if (!node) return state;

      return { ...state, clipboard: cloneNode(node) };
    }

    // -----------------------------------------------------------------------
    case 'PASTE_NODE': {
      if (!state.clipboard || !state.tree) return state;

      // Paste at end of selected node (if it can have children) or at end of root
      const pasteClone = cloneNode(state.clipboard);

      let parentId = state.tree.id;
      let index = (state.tree.children ?? []).length;

      if (state.selectedId) {
        const selectedNode = findNode(state.tree, state.selectedId);
        if (selectedNode) {
          // If selected node is a container, paste inside it
          if (Array.isArray(selectedNode.children)) {
            parentId = selectedNode.id;
            index = selectedNode.children.length;
          } else {
            // Otherwise paste as a sibling after the selected node
            const parentInfo = findParent(state.tree, state.selectedId);
            if (parentInfo) {
              parentId = parentInfo.parent.id;
              index = parentInfo.index + 1;
            }
          }
        }
      }

      const newTree = insertAt(state.tree, parentId, index, pasteClone);
      const hist = pushHistory(state, newTree);
      return { ...state, tree: newTree, dirty: true, ...hist };
    }

    // -----------------------------------------------------------------------
    case 'MOVE_NODE_UP': {
      const { id } = action.payload;
      if (!state.tree) return state;

      const parentInfo = findParent(state.tree, id);
      if (!parentInfo || parentInfo.index === 0) return state;

      const newTree = moveNode(
        state.tree,
        id,
        parentInfo.parent.id,
        parentInfo.index - 1,
      );

      const hist = pushHistory(state, newTree);
      return { ...state, tree: newTree, dirty: true, ...hist };
    }

    // -----------------------------------------------------------------------
    case 'MOVE_NODE_DOWN': {
      const { id } = action.payload;
      if (!state.tree) return state;

      const parentInfo = findParent(state.tree, id);
      if (!parentInfo) return state;

      const siblings = parentInfo.parent.children;
      if (parentInfo.index >= siblings.length - 1) return state;

      const newTree = moveNode(
        state.tree,
        id,
        parentInfo.parent.id,
        parentInfo.index + 2, // +2 because moveNode adjusts for the removal
      );

      const hist = pushHistory(state, newTree);
      return { ...state, tree: newTree, dirty: true, ...hist };
    }

    // -----------------------------------------------------------------------
    case 'SET_SIDEBAR_TAB': {
      return { ...state, sidebarTab: action.payload.tab };
    }

    // -----------------------------------------------------------------------
    case 'SET_BREAKPOINT': {
      return { ...state, breakpoint: action.payload.breakpoint };
    }

    // -----------------------------------------------------------------------
    case 'UNDO': {
      if (state.historyIndex <= 0) return state;
      const newIndex = state.historyIndex - 1;
      return {
        ...state,
        tree:         state.history[newIndex],
        historyIndex: newIndex,
        dirty:        true,
      };
    }

    // -----------------------------------------------------------------------
    case 'REDO': {
      if (state.historyIndex >= state.history.length - 1) return state;
      const newIndex = state.historyIndex + 1;
      return {
        ...state,
        tree:         state.history[newIndex],
        historyIndex: newIndex,
        dirty:        true,
      };
    }

    // -----------------------------------------------------------------------
    case 'SHOW_CONTEXT_MENU': {
      const { x, y, nodeId } = action.payload;
      return { ...state, contextMenu: { x, y, nodeId } };
    }

    case 'HIDE_CONTEXT_MENU': {
      return { ...state, contextMenu: null };
    }

    // -----------------------------------------------------------------------
    case 'TOGGLE_THEME_EDITOR': {
      return { ...state, showThemeEditor: !state.showThemeEditor };
    }

    // -----------------------------------------------------------------------
    case 'TOGGLE_CODE_EDITOR': {
      const { nodeId } = action.payload;
      // If the same node is already open, close it
      const next = state.showCodeEditor === nodeId ? null : nodeId;
      return { ...state, showCodeEditor: next };
    }

    // -----------------------------------------------------------------------
    case 'TOGGLE_EXPORT_IMPORT': {
      return { ...state, showExportImport: !state.showExportImport };
    }

    // -----------------------------------------------------------------------
    case 'UPDATE_THEME': {
      return {
        ...state,
        theme: { ...state.theme, ...action.payload.theme },
        dirty: true,
      };
    }

    // -----------------------------------------------------------------------
    case 'UPDATE_PAGE_META': {
      if (!state.page) return state;
      return {
        ...state,
        page:  { ...state.page, ...action.payload.meta },
        dirty: true,
      };
    }

    // -----------------------------------------------------------------------
    case 'SET_SAVING': {
      return { ...state, saving: true };
    }

    case 'SET_SAVED': {
      return { ...state, saving: false, dirty: false };
    }

    // -----------------------------------------------------------------------
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDesigner() {
  const [state, dispatch] = useReducer(designerReducer, INITIAL_STATE);

  // -------------------------------------------------------------------------
  // Derived values
  // -------------------------------------------------------------------------

  const canUndo = state.historyIndex > 0;
  const canRedo = state.historyIndex < state.history.length - 1;

  const selectedNode = useMemo(
    () => (state.selectedId && state.tree ? findNode(state.tree, state.selectedId) : null),
    [state.selectedId, state.tree],
  );

  // -------------------------------------------------------------------------
  // Action creators
  // All are stable references (useCallback with dispatch in dep array).
  // -------------------------------------------------------------------------

  const loadPage = useCallback(
    (page, tree, theme) =>
      dispatch({ type: 'LOAD_PAGE', payload: { page, tree, theme } }),
    [dispatch],
  );

  const selectNode = useCallback(
    (id) => dispatch({ type: 'SELECT_NODE', payload: { id } }),
    [dispatch],
  );

  const hoverNode = useCallback(
    (id) => dispatch({ type: 'HOVER_NODE', payload: { id } }),
    [dispatch],
  );

  const setDragSource = useCallback(
    (dragSource) => dispatch({ type: 'SET_DRAG_SOURCE', payload: { dragSource } }),
    [dispatch],
  );

  const setDragTarget = useCallback(
    (dragTarget) => dispatch({ type: 'SET_DRAG_TARGET', payload: { dragTarget } }),
    [dispatch],
  );

  const clearDrag = useCallback(
    () => dispatch({ type: 'CLEAR_DRAG' }),
    [dispatch],
  );

  const dropNode = useCallback(
    (dragSource, dragTarget) =>
      dispatch({ type: 'DROP_NODE', payload: { dragSource, dragTarget } }),
    [dispatch],
  );

  const updateNodeProps = useCallback(
    (id, props) =>
      dispatch({ type: 'UPDATE_NODE_PROPS', payload: { id, props } }),
    [dispatch],
  );

  const updateNodeStyle = useCallback(
    (id, styleState, style) =>
      dispatch({ type: 'UPDATE_NODE_STYLE', payload: { id, styleState, style } }),
    [dispatch],
  );

  const updateNodeLabel = useCallback(
    (id, label) =>
      dispatch({ type: 'UPDATE_NODE_LABEL', payload: { id, label } }),
    [dispatch],
  );

  const updateNodeVisibility = useCallback(
    (id, visibility) =>
      dispatch({ type: 'UPDATE_NODE_VISIBILITY', payload: { id, visibility } }),
    [dispatch],
  );

  const deleteNode = useCallback(
    (id) => dispatch({ type: 'DELETE_NODE', payload: { id } }),
    [dispatch],
  );

  const duplicateNode = useCallback(
    (id) => dispatch({ type: 'DUPLICATE_NODE', payload: { id } }),
    [dispatch],
  );

  const copyNode = useCallback(
    (id) => dispatch({ type: 'COPY_NODE', payload: { id } }),
    [dispatch],
  );

  const pasteNode = useCallback(
    () => dispatch({ type: 'PASTE_NODE' }),
    [dispatch],
  );

  const moveUp = useCallback(
    (id) => dispatch({ type: 'MOVE_NODE_UP', payload: { id } }),
    [dispatch],
  );

  const moveDown = useCallback(
    (id) => dispatch({ type: 'MOVE_NODE_DOWN', payload: { id } }),
    [dispatch],
  );

  const setSidebarTab = useCallback(
    (tab) => dispatch({ type: 'SET_SIDEBAR_TAB', payload: { tab } }),
    [dispatch],
  );

  const setBreakpoint = useCallback(
    (breakpoint) => dispatch({ type: 'SET_BREAKPOINT', payload: { breakpoint } }),
    [dispatch],
  );

  const undo = useCallback(
    () => dispatch({ type: 'UNDO' }),
    [dispatch],
  );

  const redo = useCallback(
    () => dispatch({ type: 'REDO' }),
    [dispatch],
  );

  const showContextMenu = useCallback(
    (x, y, nodeId) =>
      dispatch({ type: 'SHOW_CONTEXT_MENU', payload: { x, y, nodeId } }),
    [dispatch],
  );

  const hideContextMenu = useCallback(
    () => dispatch({ type: 'HIDE_CONTEXT_MENU' }),
    [dispatch],
  );

  const toggleThemeEditor = useCallback(
    () => dispatch({ type: 'TOGGLE_THEME_EDITOR' }),
    [dispatch],
  );

  const toggleCodeEditor = useCallback(
    (nodeId) =>
      dispatch({ type: 'TOGGLE_CODE_EDITOR', payload: { nodeId } }),
    [dispatch],
  );

  const toggleExportImport = useCallback(
    () => dispatch({ type: 'TOGGLE_EXPORT_IMPORT' }),
    [dispatch],
  );

  const updateTheme = useCallback(
    (theme) => dispatch({ type: 'UPDATE_THEME', payload: { theme } }),
    [dispatch],
  );

  const updatePageMeta = useCallback(
    (meta) => dispatch({ type: 'UPDATE_PAGE_META', payload: { meta } }),
    [dispatch],
  );

  const setSaving = useCallback(
    () => dispatch({ type: 'SET_SAVING' }),
    [dispatch],
  );

  const setSaved = useCallback(
    () => dispatch({ type: 'SET_SAVED' }),
    [dispatch],
  );

  // -------------------------------------------------------------------------
  // Keyboard shortcut handler
  // -------------------------------------------------------------------------

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Never intercept shortcuts when typing in an input, textarea, or
      // contenteditable element — the user is editing a field.
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isEditing =
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        document.activeElement?.isContentEditable;

      if (isEditing) return;

      const ctrl = e.ctrlKey || e.metaKey; // Support Cmd on macOS

      // Ctrl+Z — Undo
      if (ctrl && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        dispatch({ type: 'UNDO' });
        return;
      }

      // Ctrl+Y or Ctrl+Shift+Z — Redo
      if ((ctrl && e.key === 'y') || (ctrl && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        dispatch({ type: 'REDO' });
        return;
      }

      // Ctrl+C — Copy selected node
      if (ctrl && e.key === 'c') {
        // Use functional read of state — get selectedId from the current
        // closure. We reference the state variable from the enclosing scope.
        // Because useEffect closes over state we use the stable dispatch and
        // access the latest selectedId through a ref-like pattern via the
        // reducer itself: dispatch a no-op that reads state... instead we
        // simply read from the current closure value which is always fresh
        // because the effect re-registers whenever state changes.
        if (state.selectedId) {
          e.preventDefault();
          dispatch({ type: 'COPY_NODE', payload: { id: state.selectedId } });
        }
        return;
      }

      // Ctrl+V — Paste clipboard
      if (ctrl && e.key === 'v') {
        if (state.clipboard) {
          e.preventDefault();
          dispatch({ type: 'PASTE_NODE' });
        }
        return;
      }

      // Ctrl+D — Duplicate selected node
      if (ctrl && e.key === 'd') {
        if (state.selectedId) {
          e.preventDefault();
          dispatch({ type: 'DUPLICATE_NODE', payload: { id: state.selectedId } });
        }
        return;
      }

      // Delete / Backspace — Delete selected node
      if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedId) {
        e.preventDefault();
        dispatch({ type: 'DELETE_NODE', payload: { id: state.selectedId } });
        return;
      }

      // Escape — Deselect and close context menu
      if (e.key === 'Escape') {
        dispatch({ type: 'SELECT_NODE', payload: { id: null } });
        dispatch({ type: 'HIDE_CONTEXT_MENU' });
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    state.selectedId,
    state.clipboard,
    dispatch,
  ]);

  // -------------------------------------------------------------------------
  // Returned API
  // -------------------------------------------------------------------------

  return {
    // --- State ---
    page:             state.page,
    tree:             state.tree,
    theme:            state.theme,
    selectedId:       state.selectedId,
    hoveredId:        state.hoveredId,
    dragSource:       state.dragSource,
    dragTarget:       state.dragTarget,
    sidebarTab:       state.sidebarTab,
    breakpoint:       state.breakpoint,
    history:          state.history,
    historyIndex:     state.historyIndex,
    contextMenu:      state.contextMenu,
    showThemeEditor:  state.showThemeEditor,
    showCodeEditor:   state.showCodeEditor,
    showExportImport: state.showExportImport,
    clipboard:        state.clipboard,
    dirty:            state.dirty,
    saving:           state.saving,

    // --- Derived ---
    canUndo,
    canRedo,
    selectedNode,

    // --- Raw dispatch (escape hatch) ---
    dispatch,

    // --- Action creators ---
    loadPage,
    selectNode,
    hoverNode,
    setDragSource,
    setDragTarget,
    clearDrag,
    dropNode,
    updateNodeProps,
    updateNodeStyle,
    updateNodeLabel,
    updateNodeVisibility,
    deleteNode,
    duplicateNode,
    copyNode,
    pasteNode,
    moveUp,
    moveDown,
    setSidebarTab,
    setBreakpoint,
    undo,
    redo,
    showContextMenu,
    hideContextMenu,
    toggleThemeEditor,
    toggleCodeEditor,
    toggleExportImport,
    updateTheme,
    updatePageMeta,
    setSaving,
    setSaved,
  };
}

export default useDesigner;
