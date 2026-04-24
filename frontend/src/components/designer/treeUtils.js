/**
 * treeUtils.js
 * Pure, immutable tree-manipulation utilities for the Portal Designer.
 *
 * Node shape:
 * {
 *   id:         string,
 *   type:       string,
 *   label:      string,
 *   props:      object,
 *   style:      { base: {}, hover: {}, focus: {}, active: {} },
 *   visibility: { condition: string, value: string },
 *   children:   Node[],
 * }
 *
 * Every function that returns a tree returns a NEW tree (structural sharing
 * where the path has not changed, fresh objects where it has).  Nothing
 * mutates the original.
 */

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

/**
 * Generate a random short ID without any external package.
 * Combines Date.now (ms-precision) with a Math.random slice to make
 * collisions vanishingly unlikely within a single session.
 * @returns {string}  e.g. "m8x3kq2f9a"
 */
export function genId() {
  const ts = Date.now().toString(36);                     // base-36 timestamp
  const rnd = Math.random().toString(36).slice(2, 8);     // 6 random chars
  return ts + rnd;
}

// ---------------------------------------------------------------------------
// Traversal
// ---------------------------------------------------------------------------

/**
 * Find a node by id anywhere in the tree.
 * @param {object} root
 * @param {string} id
 * @returns {object|null}
 */
export function findNode(root, id) {
  if (!root) return null;
  if (root.id === id) return root;
  if (!root.children || root.children.length === 0) return null;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

/**
 * Find the parent of a node by its id, together with the child's index.
 * @param {object} root
 * @param {string} id
 * @returns {{ parent: object, index: number }|null}
 */
export function findParent(root, id) {
  if (!root || !root.children) return null;
  for (let i = 0; i < root.children.length; i++) {
    if (root.children[i].id === id) return { parent: root, index: i };
    const deeper = findParent(root.children[i], id);
    if (deeper) return deeper;
  }
  return null;
}

/**
 * Return the path from the root node down to (and including) the target node.
 * @param {object} root
 * @param {string} id
 * @returns {object[]|null}  array of nodes [root, …, target], or null if not found
 */
export function getNodePath(root, id) {
  if (!root) return null;
  if (root.id === id) return [root];
  if (!root.children) return null;
  for (const child of root.children) {
    const subPath = getNodePath(child, id);
    if (subPath) return [root, ...subPath];
  }
  return null;
}

/**
 * Return a flat array of every node in the tree (depth-first pre-order).
 * @param {object} root
 * @returns {object[]}
 */
export function flattenTree(root) {
  if (!root) return [];
  const result = [root];
  if (root.children) {
    for (const child of root.children) {
      result.push(...flattenTree(child));
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Immutable updates
// ---------------------------------------------------------------------------

/**
 * Return a new tree where the node with `id` is replaced by updater(node).
 * Nodes that are not on the path to the target are structurally shared.
 * @param {object}   root
 * @param {string}   id
 * @param {function} updater  (node: object) => object
 * @returns {object}
 */
export function updateNode(root, id, updater) {
  if (!root) return root;
  if (root.id === id) return updater(root);
  if (!root.children || root.children.length === 0) return root;

  let changed = false;
  const newChildren = root.children.map((child) => {
    const updated = updateNode(child, id, updater);
    if (updated !== child) changed = true;
    return updated;
  });

  if (!changed) return root;
  return { ...root, children: newChildren };
}

/**
 * Return a new tree with the node `id` removed entirely.
 * @param {object} root
 * @param {string} id
 * @returns {object}
 */
export function removeNode(root, id) {
  if (!root) return root;
  if (root.id === id) return null; // signal removal to parent

  if (!root.children || root.children.length === 0) return root;

  let changed = false;
  const newChildren = [];
  for (const child of root.children) {
    const updated = removeNode(child, id);
    if (updated === null) {
      changed = true; // this child was removed
    } else {
      if (updated !== child) changed = true;
      newChildren.push(updated);
    }
  }

  if (!changed) return root;
  return { ...root, children: newChildren };
}

/**
 * Return a new tree with `newNode` inserted at `children[index]` of the node
 * whose id is `parentId`.
 * @param {object} root
 * @param {string} parentId
 * @param {number} index      insertion position (clamped to valid range)
 * @param {object} newNode
 * @returns {object}
 */
export function insertAt(root, parentId, index, newNode) {
  return updateNode(root, parentId, (parent) => {
    const kids = parent.children ? [...parent.children] : [];
    const clampedIndex = Math.max(0, Math.min(index, kids.length));
    kids.splice(clampedIndex, 0, newNode);
    return { ...parent, children: kids };
  });
}

/**
 * Move a node from its current position to `children[targetIndex]` of
 * `targetParentId`.  Correctly handles the index-shift that happens when the
 * node is removed from the same parent before or at the target index.
 * @param {object} root
 * @param {string} nodeId
 * @param {string} targetParentId
 * @param {number} targetIndex
 * @returns {object}
 */
export function moveNode(root, nodeId, targetParentId, targetIndex) {
  const node = findNode(root, nodeId);
  if (!node) return root;

  // If moving within the same parent we need to adjust targetIndex for removal
  const parentInfo = findParent(root, nodeId);
  let adjustedIndex = targetIndex;
  if (
    parentInfo &&
    parentInfo.parent.id === targetParentId &&
    parentInfo.index < targetIndex
  ) {
    // Removing the node shifts everything down by 1
    adjustedIndex = targetIndex - 1;
  }

  const treeWithoutNode = removeNode(root, nodeId);
  return insertAt(treeWithoutNode, targetParentId, adjustedIndex, node);
}

// ---------------------------------------------------------------------------
// Clone
// ---------------------------------------------------------------------------

/**
 * Deep-clone a node (and its entire subtree), assigning fresh IDs to every
 * node so the clone is independent from the original.
 * @param {object} node
 * @returns {object}
 */
export function cloneNode(node) {
  if (!node) return node;

  const clonedChildren = node.children
    ? node.children.map((child) => cloneNode(child))
    : [];

  return {
    ...node,
    id: genId(),
    props: node.props ? JSON.parse(JSON.stringify(node.props)) : {},
    style: node.style
      ? JSON.parse(JSON.stringify(node.style))
      : { base: {}, hover: {}, focus: {}, active: {} },
    visibility: node.visibility
      ? { ...node.visibility }
      : { condition: 'always', value: '' },
    children: clonedChildren,
  };
}
