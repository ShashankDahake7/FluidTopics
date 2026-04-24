/**
 * registry.js
 * Component registry and category definitions for the Portal Designer.
 *
 * REGISTRY  — object keyed by component `type` string.
 * CATEGORIES — ordered array describing palette groupings.
 *
 * Each registry entry:
 * {
 *   type:            string   — unique key
 *   label:           string   — human-readable name
 *   icon:            string   — emoji
 *   category:        string   — matches a CATEGORIES id
 *   canHaveChildren: boolean
 *   defaultProps:    object   — initial prop values when a new node is created
 *   settings:        Setting[] — inspector panels
 *   previewColor:    string   — CSS background for the canvas placeholder
 *   description:     string
 * }
 *
 * Setting:
 * { key: string, label: string, type: SettingType, options?: string[] }
 *
 * SettingType: text | textarea | number | boolean | select | array |
 *              color | landmark | code-html | code-css | code-js | condition
 */

import { genId } from './treeUtils.js';

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export const CATEGORIES = [
  { id: 'layout',         label: 'Layout',           icon: '📐', color: '#dbeafe' },
  { id: 'basic',          label: 'Basic',             icon: '🔤', color: '#dcfce7' },
  { id: 'search',         label: 'Search',            icon: '🔍', color: '#ede9fe' },
  { id: 'search-filters', label: 'Search Filters',    icon: '🎛️', color: '#fae8ff' },
  { id: 'ai',             label: 'AI / Self-Service', icon: '🤖', color: '#fee2e2' },
  { id: 'custom',         label: 'Custom / Live',     icon: '⚡', color: '#fef3c7' },
  { id: 'conditional',    label: 'Conditional',       icon: '👁️', color: '#e0f2fe' },
  { id: 'reader',         label: 'Reader',            icon: '📖', color: '#fff7ed' },
  { id: 'search-results', label: 'Search Results',    icon: '📋', color: '#f0fdf4' },
  { id: 'topic-template', label: 'Topic Template',    icon: '📌', color: '#fdf4ff' },
  { id: 'link-preview',   label: 'Link Preview',      icon: '🔗', color: '#f0f9ff' },
  { id: 'header',         label: 'Header',            icon: '🏠', color: '#f8fafc' },
];

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const REGISTRY = {

  // =========================================================================
  // LAYOUT
  // =========================================================================

  block: {
    type: 'block',
    label: 'Block',
    icon: '📦',
    category: 'layout',
    canHaveChildren: true,
    defaultProps: {
      tag: 'div',
      className: '',
      id: '',
      role: '',
    },
    settings: [
      { key: 'tag',       label: 'HTML Tag',   type: 'select',  options: ['div', 'section', 'article', 'aside', 'main', 'nav', 'header', 'footer', 'span'] },
      { key: 'className', label: 'CSS Classes', type: 'text'  },
      { key: 'id',        label: 'Element ID',  type: 'text'  },
      { key: 'role',      label: 'ARIA Role',   type: 'landmark' },
    ],
    previewColor: '#dbeafe',
    description: 'A generic container block that maps to any HTML element. The foundation for custom layouts.',
  },

  section: {
    type: 'section',
    label: 'Section',
    icon: '▭',
    category: 'layout',
    canHaveChildren: true,
    defaultProps: {
      columns: 1,
      gap: 16,
      padding: '16px',
      background: '',
      fullWidth: false,
      minHeight: '',
      alignItems: 'stretch',
    },
    settings: [
      { key: 'columns',    label: 'Columns',         type: 'number' },
      { key: 'gap',        label: 'Gap (px)',         type: 'number' },
      { key: 'padding',    label: 'Padding',          type: 'text'   },
      { key: 'background', label: 'Background',       type: 'color'  },
      { key: 'fullWidth',  label: 'Full Width',       type: 'boolean'},
      { key: 'minHeight',  label: 'Min Height',       type: 'text'   },
      { key: 'alignItems', label: 'Align Items',      type: 'select', options: ['stretch', 'flex-start', 'center', 'flex-end', 'baseline'] },
    ],
    previewColor: '#bfdbfe',
    description: 'A structured section that supports multi-column grid layouts with configurable gap and alignment.',
  },

  'panel-resize': {
    type: 'panel-resize',
    label: 'Resizable Panel',
    icon: '↔',
    category: 'layout',
    canHaveChildren: true,
    defaultProps: {
      direction: 'horizontal',
      defaultSize: 50,
      minSize: 20,
      maxSize: 80,
      showHandle: true,
      handleColor: '#cbd5e1',
    },
    settings: [
      { key: 'direction',   label: 'Direction',       type: 'select', options: ['horizontal', 'vertical'] },
      { key: 'defaultSize', label: 'Default Size (%)', type: 'number' },
      { key: 'minSize',     label: 'Min Size (%)',     type: 'number' },
      { key: 'maxSize',     label: 'Max Size (%)',     type: 'number' },
      { key: 'showHandle',  label: 'Show Handle',      type: 'boolean'},
      { key: 'handleColor', label: 'Handle Color',     type: 'color'  },
    ],
    previewColor: '#dbeafe',
    description: 'A split-pane container whose panels can be resized by dragging a divider handle.',
  },

  'panel-collapsible': {
    type: 'panel-collapsible',
    label: 'Collapsible Panel',
    icon: '⊞',
    category: 'layout',
    canHaveChildren: true,
    defaultProps: {
      title: 'Panel Title',
      defaultOpen: true,
      showToggleIcon: true,
      animationDuration: 200,
      headerBackground: '',
      headerColor: '',
      borderRadius: 8,
    },
    settings: [
      { key: 'title',             label: 'Title',              type: 'text'    },
      { key: 'defaultOpen',       label: 'Default Open',       type: 'boolean' },
      { key: 'showToggleIcon',    label: 'Show Toggle Icon',   type: 'boolean' },
      { key: 'animationDuration', label: 'Animation (ms)',     type: 'number'  },
      { key: 'headerBackground',  label: 'Header Background',  type: 'color'   },
      { key: 'headerColor',       label: 'Header Text Color',  type: 'color'   },
      { key: 'borderRadius',      label: 'Border Radius (px)', type: 'number'  },
    ],
    previewColor: '#dbeafe',
    description: 'An accordion-style panel with a clickable header that expands or collapses its content.',
  },

  'floating-menu': {
    type: 'floating-menu',
    label: 'Floating Menu',
    icon: '⬡',
    category: 'layout',
    canHaveChildren: true,
    defaultProps: {
      position: 'bottom-right',
      offsetX: 24,
      offsetY: 24,
      triggerIcon: '☰',
      triggerLabel: 'Menu',
      zIndex: 1000,
      backdrop: false,
    },
    settings: [
      { key: 'position',     label: 'Position',      type: 'select', options: ['top-left','top-right','bottom-left','bottom-right','top-center','bottom-center'] },
      { key: 'offsetX',      label: 'Offset X (px)', type: 'number' },
      { key: 'offsetY',      label: 'Offset Y (px)', type: 'number' },
      { key: 'triggerIcon',  label: 'Trigger Icon',  type: 'text'   },
      { key: 'triggerLabel', label: 'Trigger Label', type: 'text'   },
      { key: 'zIndex',       label: 'Z-Index',       type: 'number' },
      { key: 'backdrop',     label: 'Show Backdrop', type: 'boolean'},
    ],
    previewColor: '#c7d2fe',
    description: 'A floating action button that reveals a menu of actions, anchored to a corner of the viewport.',
  },

  modal: {
    type: 'modal',
    label: 'Modal',
    icon: '⬜',
    category: 'layout',
    canHaveChildren: true,
    defaultProps: {
      title: 'Modal Title',
      width: 600,
      maxWidth: '90vw',
      closeOnBackdrop: true,
      closeOnEscape: true,
      showCloseButton: true,
      backdropOpacity: 0.5,
      zIndex: 2000,
    },
    settings: [
      { key: 'title',            label: 'Title',               type: 'text'    },
      { key: 'width',            label: 'Width (px)',           type: 'number'  },
      { key: 'maxWidth',         label: 'Max Width',           type: 'text'    },
      { key: 'closeOnBackdrop',  label: 'Close on Backdrop',   type: 'boolean' },
      { key: 'closeOnEscape',    label: 'Close on Escape',     type: 'boolean' },
      { key: 'showCloseButton',  label: 'Show Close Button',   type: 'boolean' },
      { key: 'backdropOpacity',  label: 'Backdrop Opacity',    type: 'number'  },
      { key: 'zIndex',           label: 'Z-Index',             type: 'number'  },
    ],
    previewColor: '#dbeafe',
    description: 'A full-screen overlay dialog for focused interactions. Supports backdrop dismiss and keyboard escape.',
  },

  'modal-close': {
    type: 'modal-close',
    label: 'Modal Close Button',
    icon: '✕',
    category: 'layout',
    canHaveChildren: false,
    defaultProps: {
      label: 'Close',
      icon: '✕',
      position: 'top-right',
      size: 32,
    },
    settings: [
      { key: 'label',    label: 'Accessible Label', type: 'text'   },
      { key: 'icon',     label: 'Icon',             type: 'text'   },
      { key: 'position', label: 'Position',         type: 'select', options: ['top-right','top-left','inline'] },
      { key: 'size',     label: 'Size (px)',         type: 'number' },
    ],
    previewColor: '#bfdbfe',
    description: 'A close button that dismisses its parent Modal. Must be placed inside a Modal component.',
  },

  tabs: {
    type: 'tabs',
    label: 'Tabs',
    icon: '🗂',
    category: 'layout',
    canHaveChildren: true,
    defaultProps: {
      tabs: ['Tab 1', 'Tab 2', 'Tab 3'],
      defaultTab: 0,
      orientation: 'horizontal',
      variant: 'line',
      lazy: false,
    },
    settings: [
      { key: 'tabs',        label: 'Tab Labels',   type: 'array'  },
      { key: 'defaultTab',  label: 'Default Tab',  type: 'number' },
      { key: 'orientation', label: 'Orientation',  type: 'select', options: ['horizontal', 'vertical'] },
      { key: 'variant',     label: 'Style Variant', type: 'select', options: ['line', 'enclosed', 'soft-rounded', 'solid-rounded'] },
      { key: 'lazy',        label: 'Lazy Render',  type: 'boolean'},
    ],
    previewColor: '#bfdbfe',
    description: 'A tabbed container. Each child node is assigned to the corresponding tab by position.',
  },

  // =========================================================================
  // BASIC
  // =========================================================================

  link: {
    type: 'link',
    label: 'Link',
    icon: '🔗',
    category: 'basic',
    canHaveChildren: false,
    defaultProps: {
      href: '#',
      text: 'Click here',
      target: '_self',
      rel: '',
      ariaLabel: '',
      underline: true,
    },
    settings: [
      { key: 'href',      label: 'URL',            type: 'text'    },
      { key: 'text',      label: 'Link Text',      type: 'text'    },
      { key: 'target',    label: 'Open In',        type: 'select', options: ['_self', '_blank', '_parent', '_top'] },
      { key: 'rel',       label: 'Rel Attribute',  type: 'text'    },
      { key: 'ariaLabel', label: 'ARIA Label',     type: 'text'    },
      { key: 'underline', label: 'Underline',      type: 'boolean' },
    ],
    previewColor: '#dcfce7',
    description: 'A simple hyperlink element.',
  },

  icon: {
    type: 'icon',
    label: 'Icon',
    icon: '✦',
    category: 'basic',
    canHaveChildren: false,
    defaultProps: {
      name: 'star',
      size: 24,
      color: 'currentColor',
      library: 'fluent-ui',
      ariaHidden: true,
      ariaLabel: '',
    },
    settings: [
      { key: 'name',      label: 'Icon Name',   type: 'text'    },
      { key: 'size',      label: 'Size (px)',    type: 'number'  },
      { key: 'color',     label: 'Color',        type: 'color'   },
      { key: 'library',   label: 'Icon Library', type: 'select', options: ['fluent-ui', 'heroicons', 'phosphor', 'custom-svg'] },
      { key: 'ariaHidden', label: 'ARIA Hidden', type: 'boolean' },
      { key: 'ariaLabel',  label: 'ARIA Label',  type: 'text'    },
    ],
    previewColor: '#dcfce7',
    description: 'Renders a scalable icon from a supported icon library.',
  },

  tooltip: {
    type: 'tooltip',
    label: 'Tooltip',
    icon: '💬',
    category: 'basic',
    canHaveChildren: true,
    defaultProps: {
      content: 'Tooltip text',
      placement: 'top',
      delay: 300,
      maxWidth: 240,
      trigger: 'hover',
      interactive: false,
    },
    settings: [
      { key: 'content',     label: 'Content',         type: 'textarea' },
      { key: 'placement',   label: 'Placement',       type: 'select', options: ['top','bottom','left','right','top-start','top-end','bottom-start','bottom-end'] },
      { key: 'delay',       label: 'Show Delay (ms)', type: 'number'  },
      { key: 'maxWidth',    label: 'Max Width (px)',   type: 'number'  },
      { key: 'trigger',     label: 'Trigger',          type: 'select', options: ['hover', 'click', 'focus', 'manual'] },
      { key: 'interactive', label: 'Interactive',      type: 'boolean' },
    ],
    previewColor: '#dcfce7',
    description: 'Wraps its children and shows a floating tooltip on hover or focus.',
  },

  'user-assets-count': {
    type: 'user-assets-count',
    label: 'User Assets Count',
    icon: '🔢',
    category: 'basic',
    canHaveChildren: false,
    defaultProps: {
      assetType: 'bookmarks',
      label: '{count} Bookmarks',
      showIcon: true,
      linkTo: '',
    },
    settings: [
      { key: 'assetType', label: 'Asset Type', type: 'select', options: ['bookmarks', 'history', 'downloads', 'saved-searches', 'following'] },
      { key: 'label',     label: 'Label Template ({count})', type: 'text' },
      { key: 'showIcon',  label: 'Show Icon',   type: 'boolean' },
      { key: 'linkTo',    label: 'Link URL',    type: 'text'    },
    ],
    previewColor: '#bbf7d0',
    description: 'Displays the count of a user\'s personal assets (bookmarks, history, etc.).',
  },

  'language-selector': {
    type: 'language-selector',
    label: 'Language Selector',
    icon: '🌐',
    category: 'basic',
    canHaveChildren: false,
    defaultProps: {
      variant: 'dropdown',
      showFlag: true,
      showNativeName: true,
      compact: false,
      redirectOnChange: true,
    },
    settings: [
      { key: 'variant',          label: 'Variant',           type: 'select', options: ['dropdown', 'inline-list', 'icon-only'] },
      { key: 'showFlag',         label: 'Show Flag',         type: 'boolean' },
      { key: 'showNativeName',   label: 'Show Native Name',  type: 'boolean' },
      { key: 'compact',          label: 'Compact Mode',      type: 'boolean' },
      { key: 'redirectOnChange', label: 'Redirect on Change',type: 'boolean' },
    ],
    previewColor: '#dcfce7',
    description: 'Lets users switch the portal UI language. Reads available locales from the tenant configuration.',
  },

  'theme-selector': {
    type: 'theme-selector',
    label: 'Theme Selector',
    icon: '🎨',
    category: 'basic',
    canHaveChildren: false,
    defaultProps: {
      variant: 'toggle',
      themes: ['light', 'dark'],
      showLabel: false,
      persist: true,
    },
    settings: [
      { key: 'variant',   label: 'Variant',     type: 'select', options: ['toggle', 'dropdown', 'icon-only'] },
      { key: 'themes',    label: 'Themes',      type: 'array'  },
      { key: 'showLabel', label: 'Show Label',  type: 'boolean'},
      { key: 'persist',   label: 'Persist in localStorage', type: 'boolean' },
    ],
    previewColor: '#dcfce7',
    description: 'A theme switcher (e.g. light/dark mode). Uses CSS custom properties to apply the selected theme.',
  },

  'back-button': {
    type: 'back-button',
    label: 'Back Button',
    icon: '←',
    category: 'basic',
    canHaveChildren: false,
    defaultProps: {
      label: 'Back',
      fallbackUrl: '/',
      showIcon: true,
      variant: 'ghost',
    },
    settings: [
      { key: 'label',       label: 'Label',        type: 'text'   },
      { key: 'fallbackUrl', label: 'Fallback URL', type: 'text'   },
      { key: 'showIcon',    label: 'Show Icon',    type: 'boolean'},
      { key: 'variant',     label: 'Variant',      type: 'select', options: ['ghost', 'outline', 'solid', 'link'] },
    ],
    previewColor: '#dcfce7',
    description: 'Navigates to the previous page in browser history, or falls back to a configured URL.',
  },

  'search-bar-builtin': {
    type: 'search-bar-builtin',
    label: 'Search Bar (Built-in)',
    icon: '🔎',
    category: 'basic',
    canHaveChildren: false,
    defaultProps: {
      placeholder: 'Search documentation…',
      autofocus: false,
      showIcon: true,
      clearButton: true,
      searchPageUrl: '/search',
      minChars: 2,
      debounce: 300,
    },
    settings: [
      { key: 'placeholder',   label: 'Placeholder',        type: 'text'    },
      { key: 'autofocus',     label: 'Auto Focus',         type: 'boolean' },
      { key: 'showIcon',      label: 'Show Search Icon',   type: 'boolean' },
      { key: 'clearButton',   label: 'Show Clear Button',  type: 'boolean' },
      { key: 'searchPageUrl', label: 'Search Page URL',    type: 'text'    },
      { key: 'minChars',      label: 'Min Chars to Search',type: 'number'  },
      { key: 'debounce',      label: 'Debounce (ms)',      type: 'number'  },
    ],
    previewColor: '#bbf7d0',
    description: 'A standalone search input that navigates to the Search page with the query pre-filled.',
  },

  'topic-content': {
    type: 'topic-content',
    label: 'Topic Content',
    icon: '📄',
    category: 'basic',
    canHaveChildren: false,
    defaultProps: {
      renderHtml: true,
      sanitize: true,
      codeHighlighting: true,
      imageZoom: true,
      printButton: false,
    },
    settings: [
      { key: 'renderHtml',       label: 'Render HTML',         type: 'boolean' },
      { key: 'sanitize',         label: 'Sanitize HTML',       type: 'boolean' },
      { key: 'codeHighlighting', label: 'Code Highlighting',   type: 'boolean' },
      { key: 'imageZoom',        label: 'Image Zoom',          type: 'boolean' },
      { key: 'printButton',      label: 'Show Print Button',   type: 'boolean' },
    ],
    previewColor: '#dcfce7',
    description: 'Renders the full HTML content of the current topic with optional code highlighting and image zoom.',
  },

  // =========================================================================
  // SEARCH
  // =========================================================================

  'search-block': {
    type: 'search-block',
    label: 'Search Block',
    icon: '🔍',
    category: 'search',
    canHaveChildren: true,
    defaultProps: {
      layout: 'vertical',
      showFilters: true,
      showSorting: true,
      showResultCount: true,
      persistQuery: true,
    },
    settings: [
      { key: 'layout',          label: 'Layout',             type: 'select', options: ['vertical', 'horizontal', 'sidebar'] },
      { key: 'showFilters',     label: 'Show Filters',       type: 'boolean' },
      { key: 'showSorting',     label: 'Show Sorting',       type: 'boolean' },
      { key: 'showResultCount', label: 'Show Result Count',  type: 'boolean' },
      { key: 'persistQuery',    label: 'Persist Query',      type: 'boolean' },
    ],
    previewColor: '#ede9fe',
    description: 'Top-level container that provides search context to all child search components.',
  },

  'search-bar': {
    type: 'search-bar',
    label: 'Search Bar',
    icon: '🔍',
    category: 'search',
    canHaveChildren: false,
    defaultProps: {
      placeholder: 'Search…',
      autofocus: true,
      suggestions: true,
      maxSuggestions: 5,
      showHistory: true,
      clearButton: true,
      voiceSearch: false,
      debounce: 300,
    },
    settings: [
      { key: 'placeholder',    label: 'Placeholder',          type: 'text'    },
      { key: 'autofocus',      label: 'Auto Focus',           type: 'boolean' },
      { key: 'suggestions',    label: 'Show Suggestions',     type: 'boolean' },
      { key: 'maxSuggestions', label: 'Max Suggestions',      type: 'number'  },
      { key: 'showHistory',    label: 'Show Search History',  type: 'boolean' },
      { key: 'clearButton',    label: 'Show Clear Button',    type: 'boolean' },
      { key: 'voiceSearch',    label: 'Voice Search',         type: 'boolean' },
      { key: 'debounce',       label: 'Debounce (ms)',        type: 'number'  },
    ],
    previewColor: '#ddd6fe',
    description: 'The main search input for the Search page. Feeds its query to sibling search components.',
  },

  'search-results-list': {
    type: 'search-results-list',
    label: 'Search Results List',
    icon: '📋',
    category: 'search',
    canHaveChildren: false,
    defaultProps: {
      pageSize: 10,
      showPagination: true,
      paginationStyle: 'pages',
      showScore: false,
      resultComponent: 'default',
      emptyMessage: 'No results found for your query.',
      loadingStyle: 'skeleton',
    },
    settings: [
      { key: 'pageSize',        label: 'Results per Page',   type: 'number'  },
      { key: 'showPagination',  label: 'Show Pagination',    type: 'boolean' },
      { key: 'paginationStyle', label: 'Pagination Style',   type: 'select', options: ['pages', 'load-more', 'infinite-scroll'] },
      { key: 'showScore',       label: 'Show Relevance Score',type: 'boolean'},
      { key: 'emptyMessage',    label: 'Empty State Message', type: 'textarea' },
      { key: 'loadingStyle',    label: 'Loading Style',      type: 'select', options: ['skeleton', 'spinner', 'none'] },
    ],
    previewColor: '#ede9fe',
    description: 'Renders the paginated list of search results. Must be placed inside a Search Block.',
  },

  spellcheck: {
    type: 'spellcheck',
    label: 'Spell Check Suggestion',
    icon: '✏️',
    category: 'search',
    canHaveChildren: false,
    defaultProps: {
      prefix: 'Did you mean:',
      autoCorrect: false,
    },
    settings: [
      { key: 'prefix',      label: 'Prefix Text',    type: 'text'    },
      { key: 'autoCorrect', label: 'Auto-Correct',   type: 'boolean' },
    ],
    previewColor: '#ddd6fe',
    description: 'Shows a spelling suggestion when the search engine detects a probable typo.',
  },

  'action-block': {
    type: 'action-block',
    label: 'Search Action Block',
    icon: '⚡',
    category: 'search',
    canHaveChildren: false,
    defaultProps: {
      actions: ['save-search', 'export-results', 'subscribe'],
      compact: false,
      position: 'top-right',
    },
    settings: [
      { key: 'actions',  label: 'Enabled Actions', type: 'array'   },
      { key: 'compact',  label: 'Compact Mode',    type: 'boolean' },
      { key: 'position', label: 'Position',        type: 'select', options: ['top-right', 'top-left', 'bottom-right', 'bottom-left'] },
    ],
    previewColor: '#ede9fe',
    description: 'A toolbar of contextual actions available on the search results page (save search, export, etc.).',
  },

  'saved-searches': {
    type: 'saved-searches',
    label: 'Saved Searches',
    icon: '💾',
    category: 'search',
    canHaveChildren: false,
    defaultProps: {
      maxItems: 10,
      showDate: true,
      allowDelete: true,
      emptyMessage: 'No saved searches yet.',
    },
    settings: [
      { key: 'maxItems',     label: 'Max Items',         type: 'number'   },
      { key: 'showDate',     label: 'Show Date',         type: 'boolean'  },
      { key: 'allowDelete',  label: 'Allow Delete',      type: 'boolean'  },
      { key: 'emptyMessage', label: 'Empty Message',     type: 'textarea' },
    ],
    previewColor: '#ddd6fe',
    description: 'Lists the current user\'s saved search queries with options to re-run or delete them.',
  },

  // =========================================================================
  // SEARCH FILTERS
  // =========================================================================

  filter: {
    type: 'filter',
    label: 'Filter',
    icon: '🎛️',
    category: 'search-filters',
    canHaveChildren: false,
    defaultProps: {
      field: '',
      label: 'Filter',
      displayType: 'checkbox',
      multiSelect: true,
      maxVisible: 8,
      showSearch: false,
      collapsed: false,
      sortOptions: 'count-desc',
    },
    settings: [
      { key: 'field',       label: 'Metadata Field',   type: 'text'   },
      { key: 'label',       label: 'Filter Label',     type: 'text'   },
      { key: 'displayType', label: 'Display Type',     type: 'select', options: ['checkbox', 'radio', 'tag-list', 'dropdown', 'range'] },
      { key: 'multiSelect', label: 'Multi-Select',     type: 'boolean'},
      { key: 'maxVisible',  label: 'Max Visible',      type: 'number' },
      { key: 'showSearch',  label: 'Searchable',       type: 'boolean'},
      { key: 'collapsed',   label: 'Start Collapsed',  type: 'boolean'},
      { key: 'sortOptions', label: 'Sort Options By',  type: 'select', options: ['count-desc', 'count-asc', 'alpha-asc', 'alpha-desc'] },
    ],
    previewColor: '#fae8ff',
    description: 'A faceted filter for a specific metadata field. Narrows search results when values are selected.',
  },

  'tree-filter': {
    type: 'tree-filter',
    label: 'Tree Filter',
    icon: '🌲',
    category: 'search-filters',
    canHaveChildren: false,
    defaultProps: {
      field: 'toc',
      label: 'Publication',
      expandDepth: 1,
      showCount: true,
      collapsed: false,
      multiSelect: false,
    },
    settings: [
      { key: 'field',       label: 'Hierarchy Field', type: 'text'    },
      { key: 'label',       label: 'Filter Label',    type: 'text'    },
      { key: 'expandDepth', label: 'Expand Depth',    type: 'number'  },
      { key: 'showCount',   label: 'Show Count',      type: 'boolean' },
      { key: 'collapsed',   label: 'Start Collapsed', type: 'boolean' },
      { key: 'multiSelect', label: 'Multi-Select',    type: 'boolean' },
    ],
    previewColor: '#f0abfc',
    description: 'Hierarchical tree filter for taxonomy-based metadata fields like publication structure.',
  },

  'search-scope': {
    type: 'search-scope',
    label: 'Search Scope',
    icon: '🎯',
    category: 'search-filters',
    canHaveChildren: false,
    defaultProps: {
      scopes: [],
      defaultScope: 'all',
      showLabel: true,
      variant: 'tabs',
    },
    settings: [
      { key: 'scopes',       label: 'Scope Definitions', type: 'array'  },
      { key: 'defaultScope', label: 'Default Scope',     type: 'text'   },
      { key: 'showLabel',    label: 'Show Label',        type: 'boolean'},
      { key: 'variant',      label: 'Variant',           type: 'select', options: ['tabs', 'dropdown', 'pills'] },
    ],
    previewColor: '#fae8ff',
    description: 'Lets users switch between predefined search scopes (e.g., All, API Docs, Guides).',
  },

  'period-filter': {
    type: 'period-filter',
    label: 'Period Filter',
    icon: '📅',
    category: 'search-filters',
    canHaveChildren: false,
    defaultProps: {
      field: 'updatedAt',
      label: 'Date Range',
      presets: ['today', 'last-7-days', 'last-30-days', 'last-year', 'custom'],
      showCustomRange: true,
      collapsed: false,
    },
    settings: [
      { key: 'field',           label: 'Date Field',       type: 'text'    },
      { key: 'label',           label: 'Filter Label',     type: 'text'    },
      { key: 'presets',         label: 'Preset Options',   type: 'array'   },
      { key: 'showCustomRange', label: 'Allow Custom Range', type: 'boolean'},
      { key: 'collapsed',       label: 'Start Collapsed',  type: 'boolean' },
    ],
    previewColor: '#fae8ff',
    description: 'Date/period filter that restricts results to documents updated within a selected time window.',
  },

  'content-language': {
    type: 'content-language',
    label: 'Content Language',
    icon: '🌍',
    category: 'search-filters',
    canHaveChildren: false,
    defaultProps: {
      label: 'Language',
      multiSelect: true,
      showFlags: true,
      showNativeNames: true,
      collapsed: false,
    },
    settings: [
      { key: 'label',           label: 'Filter Label',      type: 'text'    },
      { key: 'multiSelect',     label: 'Multi-Select',      type: 'boolean' },
      { key: 'showFlags',       label: 'Show Flags',        type: 'boolean' },
      { key: 'showNativeNames', label: 'Show Native Names', type: 'boolean' },
      { key: 'collapsed',       label: 'Start Collapsed',   type: 'boolean' },
    ],
    previewColor: '#f0abfc',
    description: 'Filters search results to only show documents in the selected content language(s).',
  },

  'sort-control': {
    type: 'sort-control',
    label: 'Sort Control',
    icon: '↕',
    category: 'search-filters',
    canHaveChildren: false,
    defaultProps: {
      options: [
        { value: 'relevance', label: 'Relevance' },
        { value: 'date-desc', label: 'Newest First' },
        { value: 'date-asc',  label: 'Oldest First' },
        { value: 'alpha-asc', label: 'A – Z' },
      ],
      defaultSort: 'relevance',
      variant: 'dropdown',
      label: 'Sort by',
    },
    settings: [
      { key: 'defaultSort', label: 'Default Sort',  type: 'text'   },
      { key: 'variant',     label: 'Variant',       type: 'select', options: ['dropdown', 'radio', 'pills'] },
      { key: 'label',       label: 'Label',         type: 'text'   },
    ],
    previewColor: '#fae8ff',
    description: 'Allows users to change the sort order of search results.',
  },

  // =========================================================================
  // AI / SELF-SERVICE
  // =========================================================================

  chatbot: {
    type: 'chatbot',
    label: 'AI Chatbot',
    icon: '🤖',
    category: 'ai',
    canHaveChildren: false,
    defaultProps: {
      mode: 'embedded',
      welcomeMessage: 'Hi! How can I help you today?',
      placeholder: 'Type your question…',
      maxHeight: 500,
      showSources: true,
      allowFeedback: true,
      persona: 'Support Assistant',
      avatarUrl: '',
      model: 'default',
    },
    settings: [
      { key: 'mode',           label: 'Display Mode',       type: 'select', options: ['embedded', 'floating', 'fullscreen'] },
      { key: 'welcomeMessage', label: 'Welcome Message',    type: 'textarea' },
      { key: 'placeholder',    label: 'Input Placeholder',  type: 'text'    },
      { key: 'maxHeight',      label: 'Max Height (px)',    type: 'number'  },
      { key: 'showSources',    label: 'Show Source Links',  type: 'boolean' },
      { key: 'allowFeedback',  label: 'Allow Feedback',     type: 'boolean' },
      { key: 'persona',        label: 'Bot Persona Name',   type: 'text'    },
      { key: 'avatarUrl',      label: 'Avatar URL',         type: 'text'    },
      { key: 'model',          label: 'Model Override',     type: 'text'    },
    ],
    previewColor: '#fee2e2',
    description: 'An AI-powered chat interface that answers user questions using the portal knowledge base.',
  },

  'ai-case-deflection': {
    type: 'ai-case-deflection',
    label: 'AI Case Deflection',
    icon: '🛡️',
    category: 'ai',
    canHaveChildren: false,
    defaultProps: {
      triggerMode: 'on-load',
      maxSuggestions: 3,
      showConfidenceScore: false,
      deflectionThreshold: 0.7,
      escalationLabel: 'Still need help?',
      escalationUrl: '/contact',
      compact: false,
    },
    settings: [
      { key: 'triggerMode',          label: 'Trigger Mode',          type: 'select', options: ['on-load', 'after-search', 'on-click'] },
      { key: 'maxSuggestions',       label: 'Max Suggestions',       type: 'number'  },
      { key: 'showConfidenceScore',  label: 'Show Confidence Score', type: 'boolean' },
      { key: 'deflectionThreshold',  label: 'Deflection Threshold',  type: 'number'  },
      { key: 'escalationLabel',      label: 'Escalation Label',      type: 'text'    },
      { key: 'escalationUrl',        label: 'Escalation URL',        type: 'text'    },
      { key: 'compact',              label: 'Compact Mode',          type: 'boolean' },
    ],
    previewColor: '#fecaca',
    description: 'Surfaces AI-suggested articles to deflect support tickets before users escalate to an agent.',
  },

  // =========================================================================
  // CUSTOM / LIVE
  // =========================================================================

  'custom-component': {
    type: 'custom-component',
    label: 'Custom Component',
    icon: '⚡',
    category: 'custom',
    canHaveChildren: false,
    defaultProps: {
      html: '<div class="custom-root">Hello from custom HTML</div>',
      css: '.custom-root { padding: 16px; border: 1px dashed #ccc; }',
      js: '// Access the host element via `el`\n// Access portal context via `window.__ftPortal`\nconsole.log("Custom component mounted", el);',
      sandboxed: true,
    },
    settings: [
      { key: 'html',      label: 'HTML',       type: 'code-html' },
      { key: 'css',       label: 'CSS',        type: 'code-css'  },
      { key: 'js',        label: 'JavaScript', type: 'code-js'   },
      { key: 'sandboxed', label: 'Sandboxed',  type: 'boolean'   },
    ],
    previewColor: '#fef3c7',
    description: 'Inject arbitrary HTML, CSS, and JavaScript into the page. Rendered in an isolated shadow DOM.',
  },

  'live-component': {
    type: 'live-component',
    label: 'Live Component',
    icon: '🔴',
    category: 'custom',
    canHaveChildren: false,
    defaultProps: {
      js: `// Live reactive component
// Return an object with { render, mounted, destroy } lifecycle hooks.
// 'state' is reactive — update it to trigger re-renders.
({
  state: { count: 0 },
  render(state) {
    return \`<div>
      <p>Count: \${state.count}</p>
      <button onclick="this.increment()">+</button>
    </div>\`;
  },
  mounted(el, state) {
    el.querySelector('button').addEventListener('click', () => {
      state.count++;
    });
  },
  destroy() {},
})`,
      refreshInterval: 0,
    },
    settings: [
      { key: 'js',              label: 'Component Definition', type: 'code-js' },
      { key: 'refreshInterval', label: 'Auto-Refresh (ms, 0=off)', type: 'number' },
    ],
    previewColor: '#fde68a',
    description: 'A fully reactive custom component defined entirely in JavaScript with render/mounted/destroy hooks.',
  },

  // =========================================================================
  // CONDITIONAL
  // =========================================================================

  'conditional-visibility': {
    type: 'conditional-visibility',
    label: 'Conditional Visibility',
    icon: '👁️',
    category: 'conditional',
    canHaveChildren: true,
    defaultProps: {
      condition: 'always',
      conditionValue: '',
      fallbackBehavior: 'hide',
    },
    settings: [
      {
        key: 'condition',
        label: 'Show When',
        type: 'select',
        options: ['always', 'role', 'metadata', 'device', 'logged-in', 'logged-out'],
      },
      { key: 'conditionValue',   label: 'Condition Value',  type: 'condition' },
      { key: 'fallbackBehavior', label: 'When Hidden',      type: 'select', options: ['hide', 'placeholder', 'collapse'] },
    ],
    previewColor: '#e0f2fe',
    description: 'Wraps children and shows or hides them based on a runtime condition (role, device, login state, etc.).',
  },

  // =========================================================================
  // READER PAGE
  // =========================================================================

  toc: {
    type: 'toc',
    label: 'Table of Contents',
    icon: '📑',
    category: 'reader',
    canHaveChildren: false,
    defaultProps: {
      depth: 3,
      sticky: true,
      highlightActive: true,
      showTitle: true,
      title: 'On this page',
      collapsible: false,
      minHeadings: 2,
    },
    settings: [
      { key: 'depth',           label: 'Max Depth',         type: 'number'  },
      { key: 'sticky',          label: 'Sticky',            type: 'boolean' },
      { key: 'highlightActive', label: 'Highlight Active',  type: 'boolean' },
      { key: 'showTitle',       label: 'Show Title',        type: 'boolean' },
      { key: 'title',           label: 'Title',             type: 'text'    },
      { key: 'collapsible',     label: 'Collapsible',       type: 'boolean' },
      { key: 'minHeadings',     label: 'Min Headings to Show', type: 'number' },
    ],
    previewColor: '#fff7ed',
    description: 'Full publication Table of Contents for the Reader sidebar. Highlights the current section as the user scrolls.',
  },

  'mini-toc': {
    type: 'mini-toc',
    label: 'Mini TOC',
    icon: '🗒',
    category: 'reader',
    canHaveChildren: false,
    defaultProps: {
      depth: 2,
      sticky: true,
      highlightActive: true,
      title: 'On this page',
    },
    settings: [
      { key: 'depth',           label: 'Max Depth',        type: 'number'  },
      { key: 'sticky',          label: 'Sticky',           type: 'boolean' },
      { key: 'highlightActive', label: 'Highlight Active', type: 'boolean' },
      { key: 'title',           label: 'Section Title',    type: 'text'    },
    ],
    previewColor: '#fed7aa',
    description: 'In-page heading navigator showing only headings within the current document.',
  },

  'document-title': {
    type: 'document-title',
    label: 'Document Title',
    icon: '📌',
    category: 'reader',
    canHaveChildren: false,
    defaultProps: {
      tag: 'h1',
      showBreadcrumb: false,
      clampLines: 0,
    },
    settings: [
      { key: 'tag',           label: 'HTML Tag',      type: 'select', options: ['h1', 'h2', 'h3', 'div', 'span'] },
      { key: 'showBreadcrumb',label: 'Show Breadcrumb Above', type: 'boolean' },
      { key: 'clampLines',    label: 'Clamp Lines (0=off)', type: 'number' },
    ],
    previewColor: '#fff7ed',
    description: 'Renders the title of the current document from the API response.',
  },

  'page-title': {
    type: 'page-title',
    label: 'Page Title',
    icon: '🏷',
    category: 'reader',
    canHaveChildren: false,
    defaultProps: {
      syncWithBrowserTitle: true,
      suffix: '— FluidTopics',
      tag: 'title',
    },
    settings: [
      { key: 'syncWithBrowserTitle', label: 'Sync with Browser Tab Title', type: 'boolean' },
      { key: 'suffix',               label: 'Title Suffix',                type: 'text'    },
      { key: 'tag',                  label: 'Render As',                   type: 'select', options: ['title', 'h1', 'h2', 'span', 'none'] },
    ],
    previewColor: '#fff7ed',
    description: 'Controls the visible page title and optionally syncs it with the browser tab title.',
  },

  'document-metadata': {
    type: 'document-metadata',
    label: 'Document Metadata',
    icon: 'ℹ️',
    category: 'reader',
    canHaveChildren: false,
    defaultProps: {
      fields: ['author', 'updatedAt', 'version', 'product', 'tags'],
      dateFormat: 'MMM D, YYYY',
      layout: 'inline',
      showIcons: true,
    },
    settings: [
      { key: 'fields',     label: 'Displayed Fields', type: 'array'  },
      { key: 'dateFormat', label: 'Date Format',      type: 'text'   },
      { key: 'layout',     label: 'Layout',           type: 'select', options: ['inline', 'vertical', 'grid'] },
      { key: 'showIcons',  label: 'Show Icons',       type: 'boolean'},
    ],
    previewColor: '#fff7ed',
    description: 'Displays configurable metadata fields (author, date, version, tags) for the current document.',
  },

  'search-in-document': {
    type: 'search-in-document',
    label: 'Search in Document',
    icon: '🔍',
    category: 'reader',
    canHaveChildren: false,
    defaultProps: {
      placeholder: 'Find in document…',
      highlightColor: '#fff176',
      caseSensitive: false,
      wholeWord: false,
      shortcut: 'Ctrl+F',
    },
    settings: [
      { key: 'placeholder',    label: 'Placeholder',      type: 'text'   },
      { key: 'highlightColor', label: 'Highlight Color',  type: 'color'  },
      { key: 'caseSensitive',  label: 'Case Sensitive',   type: 'boolean'},
      { key: 'wholeWord',      label: 'Whole Word',       type: 'boolean'},
      { key: 'shortcut',       label: 'Keyboard Shortcut', type: 'text'  },
    ],
    previewColor: '#fed7aa',
    description: 'Ctrl+F-style in-page text search with hit highlighting and navigation arrows.',
  },

  'content-area': {
    type: 'content-area',
    label: 'Content Area',
    icon: '📰',
    category: 'reader',
    canHaveChildren: false,
    defaultProps: {
      maxWidth: 780,
      lineHeight: 1.8,
      fontSize: '1rem',
      codeHighlighting: true,
      copyCodeButton: true,
      imageZoom: true,
      renderMath: false,
    },
    settings: [
      { key: 'maxWidth',         label: 'Max Width (px)',     type: 'number'  },
      { key: 'lineHeight',       label: 'Line Height',        type: 'number'  },
      { key: 'fontSize',         label: 'Font Size',          type: 'text'    },
      { key: 'codeHighlighting', label: 'Code Highlighting',  type: 'boolean' },
      { key: 'copyCodeButton',   label: 'Copy Code Button',   type: 'boolean' },
      { key: 'imageZoom',        label: 'Image Zoom on Click',type: 'boolean' },
      { key: 'renderMath',       label: 'Render LaTeX Math',  type: 'boolean' },
    ],
    previewColor: '#fff7ed',
    description: 'The primary HTML content rendering zone with typography controls and code block enhancements.',
  },

  'document-feedback': {
    type: 'document-feedback',
    label: 'Document Feedback',
    icon: '💬',
    category: 'reader',
    canHaveChildren: false,
    defaultProps: {
      question: 'Was this article helpful?',
      positiveLabel: 'Yes',
      negativeLabel: 'No',
      showCommentBox: true,
      commentPlaceholder: 'Tell us how we can improve…',
      thankYouMessage: 'Thank you for your feedback!',
      requireLogin: false,
    },
    settings: [
      { key: 'question',           label: 'Question',          type: 'text'     },
      { key: 'positiveLabel',      label: 'Positive Label',    type: 'text'     },
      { key: 'negativeLabel',      label: 'Negative Label',    type: 'text'     },
      { key: 'showCommentBox',     label: 'Show Comment Box',  type: 'boolean'  },
      { key: 'commentPlaceholder', label: 'Comment Placeholder', type: 'text'  },
      { key: 'thankYouMessage',    label: 'Thank-You Message', type: 'textarea' },
      { key: 'requireLogin',       label: 'Require Login',     type: 'boolean'  },
    ],
    previewColor: '#ffedd5',
    description: 'Yes/No thumbs widget for collecting article helpfulness feedback, with an optional comment box.',
  },

  'document-rating': {
    type: 'document-rating',
    label: 'Document Rating',
    icon: '⭐',
    category: 'reader',
    canHaveChildren: false,
    defaultProps: {
      maxStars: 5,
      showAverage: true,
      showCount: true,
      requireLogin: false,
      label: 'Rate this article',
    },
    settings: [
      { key: 'maxStars',    label: 'Max Stars',       type: 'number'  },
      { key: 'showAverage', label: 'Show Average',    type: 'boolean' },
      { key: 'showCount',   label: 'Show Rating Count', type: 'boolean'},
      { key: 'requireLogin',label: 'Require Login',   type: 'boolean' },
      { key: 'label',       label: 'Label',           type: 'text'    },
    ],
    previewColor: '#fff7ed',
    description: 'Star rating widget that lets readers rate document quality. Aggregated average shown publicly.',
  },

  attachments: {
    type: 'attachments',
    label: 'Attachments',
    icon: '📎',
    category: 'reader',
    canHaveChildren: false,
    defaultProps: {
      label: 'Attachments',
      showFileSize: true,
      showFileType: true,
      showDownloadCount: false,
      layout: 'list',
      emptyMessage: '',
    },
    settings: [
      { key: 'label',             label: 'Section Label',      type: 'text'    },
      { key: 'showFileSize',      label: 'Show File Size',     type: 'boolean' },
      { key: 'showFileType',      label: 'Show File Type',     type: 'boolean' },
      { key: 'showDownloadCount', label: 'Show Download Count',type: 'boolean' },
      { key: 'layout',            label: 'Layout',             type: 'select', options: ['list', 'grid', 'compact'] },
      { key: 'emptyMessage',      label: 'Empty Message',      type: 'text'    },
    ],
    previewColor: '#ffedd5',
    description: 'Lists downloadable file attachments associated with the current document.',
  },

  'attachments-count': {
    type: 'attachments-count',
    label: 'Attachments Count',
    icon: '🔢',
    category: 'reader',
    canHaveChildren: false,
    defaultProps: {
      label: '{count} attachment(s)',
      showWhenZero: false,
      linkToSection: true,
    },
    settings: [
      { key: 'label',         label: 'Label Template',    type: 'text'    },
      { key: 'showWhenZero',  label: 'Show When Zero',    type: 'boolean' },
      { key: 'linkToSection', label: 'Link to Attachments Section', type: 'boolean' },
    ],
    previewColor: '#fff7ed',
    description: 'Compact badge showing the number of attachments. Can link to the Attachments component.',
  },

  'saved-bookmarks': {
    type: 'saved-bookmarks',
    label: 'Saved Bookmarks',
    icon: '🔖',
    category: 'reader',
    canHaveChildren: false,
    defaultProps: {
      maxItems: 20,
      showDate: true,
      groupByCollection: false,
      emptyMessage: 'No bookmarks saved yet.',
      allowManage: true,
    },
    settings: [
      { key: 'maxItems',           label: 'Max Items',           type: 'number'   },
      { key: 'showDate',           label: 'Show Saved Date',     type: 'boolean'  },
      { key: 'groupByCollection',  label: 'Group by Collection', type: 'boolean'  },
      { key: 'emptyMessage',       label: 'Empty Message',       type: 'textarea' },
      { key: 'allowManage',        label: 'Allow Manage',        type: 'boolean'  },
    ],
    previewColor: '#fff7ed',
    description: 'Shows the current user\'s bookmarked articles with options to organise and remove entries.',
  },

  'admin-tools': {
    type: 'admin-tools',
    label: 'Admin Tools',
    icon: '🛠',
    category: 'reader',
    canHaveChildren: false,
    defaultProps: {
      tools: ['edit', 'history', 'permissions', 'analytics', 'delete'],
      compact: false,
      requireRole: 'admin',
    },
    settings: [
      { key: 'tools',       label: 'Enabled Tools', type: 'array'  },
      { key: 'compact',     label: 'Compact Mode',  type: 'boolean'},
      { key: 'requireRole', label: 'Required Role', type: 'text'   },
    ],
    previewColor: '#ffedd5',
    description: 'Admin-only action bar with links to edit, view history, manage permissions and analytics for the document.',
  },

  breadcrumb: {
    type: 'breadcrumb',
    label: 'Breadcrumb',
    icon: '›',
    category: 'reader',
    canHaveChildren: false,
    defaultProps: {
      separator: '›',
      maxItems: 5,
      collapsible: true,
      showHome: true,
      homeLabel: 'Home',
      homeUrl: '/',
    },
    settings: [
      { key: 'separator',  label: 'Separator',      type: 'text'    },
      { key: 'maxItems',   label: 'Max Visible',    type: 'number'  },
      { key: 'collapsible',label: 'Collapsible',    type: 'boolean' },
      { key: 'showHome',   label: 'Show Home',      type: 'boolean' },
      { key: 'homeLabel',  label: 'Home Label',     type: 'text'    },
      { key: 'homeUrl',    label: 'Home URL',       type: 'text'    },
    ],
    previewColor: '#fff7ed',
    description: 'Navigation breadcrumb trail derived from the document\'s position in the publication hierarchy.',
  },

  'on-demand-translation': {
    type: 'on-demand-translation',
    label: 'On-Demand Translation',
    icon: '🌐',
    category: 'reader',
    canHaveChildren: false,
    defaultProps: {
      provider: 'google',
      targetLanguageSource: 'user-preference',
      showOriginalToggle: true,
      disclaimerText: 'Machine translated — may contain errors.',
      showDisclaimer: true,
    },
    settings: [
      { key: 'provider',            label: 'Translation Provider', type: 'select', options: ['google', 'deepl', 'azure', 'custom'] },
      { key: 'targetLanguageSource',label: 'Target Language From', type: 'select', options: ['user-preference', 'browser', 'explicit'] },
      { key: 'showOriginalToggle',  label: 'Show "View Original" Toggle', type: 'boolean' },
      { key: 'disclaimerText',      label: 'Disclaimer Text',     type: 'textarea' },
      { key: 'showDisclaimer',      label: 'Show Disclaimer',     type: 'boolean'  },
    ],
    previewColor: '#ffedd5',
    description: 'Button that translates the current document into the user\'s preferred language on demand.',
  },

  // =========================================================================
  // SEARCH RESULTS PAGE
  // =========================================================================

  'result-link': {
    type: 'result-link',
    label: 'Result Link',
    icon: '🔗',
    category: 'search-results',
    canHaveChildren: false,
    defaultProps: {
      openInNewTab: false,
      showIcon: true,
      truncateTitle: true,
      maxTitleLength: 80,
      highlightQuery: true,
    },
    settings: [
      { key: 'openInNewTab',    label: 'Open in New Tab',   type: 'boolean' },
      { key: 'showIcon',        label: 'Show Doc Icon',     type: 'boolean' },
      { key: 'truncateTitle',   label: 'Truncate Title',    type: 'boolean' },
      { key: 'maxTitleLength',  label: 'Max Title Length',  type: 'number'  },
      { key: 'highlightQuery',  label: 'Highlight Query',   type: 'boolean' },
    ],
    previewColor: '#f0fdf4',
    description: 'Clickable title link for a search result card. Must be inside a Search Results List.',
  },

  'result-metadata': {
    type: 'result-metadata',
    label: 'Result Metadata',
    icon: 'ℹ️',
    category: 'search-results',
    canHaveChildren: false,
    defaultProps: {
      fields: ['product', 'version', 'updatedAt', 'author'],
      separator: '·',
      dateFormat: 'MMM D, YYYY',
      compact: false,
    },
    settings: [
      { key: 'fields',    label: 'Displayed Fields', type: 'array'  },
      { key: 'separator', label: 'Field Separator',  type: 'text'   },
      { key: 'dateFormat',label: 'Date Format',      type: 'text'   },
      { key: 'compact',   label: 'Compact Mode',     type: 'boolean'},
    ],
    previewColor: '#dcfce7',
    description: 'Metadata badges/labels shown below the result title (product, version, date, etc.).',
  },

  'missing-keywords': {
    type: 'missing-keywords',
    label: 'Missing Keywords',
    icon: '⚠️',
    category: 'search-results',
    canHaveChildren: false,
    defaultProps: {
      label: 'Not all search terms were found:',
      showSuggestions: true,
    },
    settings: [
      { key: 'label',           label: 'Label Text',        type: 'text'    },
      { key: 'showSuggestions', label: 'Show Alternatives', type: 'boolean' },
    ],
    previewColor: '#f0fdf4',
    description: 'Alerts users when some of their query terms could not be found, with alternative suggestions.',
  },

  'result-preview': {
    type: 'result-preview',
    label: 'Result Preview',
    icon: '👁️',
    category: 'search-results',
    canHaveChildren: false,
    defaultProps: {
      maxLines: 3,
      highlightQuery: true,
      showEllipsis: true,
      stripHtml: true,
    },
    settings: [
      { key: 'maxLines',      label: 'Max Lines',          type: 'number'  },
      { key: 'highlightQuery',label: 'Highlight Query',    type: 'boolean' },
      { key: 'showEllipsis',  label: 'Show Ellipsis',      type: 'boolean' },
      { key: 'stripHtml',     label: 'Strip HTML Tags',    type: 'boolean' },
    ],
    previewColor: '#dcfce7',
    description: 'Text snippet preview extracted from the result document with query-term highlighting.',
  },

  'result-breadcrumb': {
    type: 'result-breadcrumb',
    label: 'Result Breadcrumb',
    icon: '›',
    category: 'search-results',
    canHaveChildren: false,
    defaultProps: {
      separator: '›',
      maxDepth: 3,
      linkable: true,
      compact: true,
    },
    settings: [
      { key: 'separator', label: 'Separator',   type: 'text'    },
      { key: 'maxDepth',  label: 'Max Depth',   type: 'number'  },
      { key: 'linkable',  label: 'Linkable',    type: 'boolean' },
      { key: 'compact',   label: 'Compact',     type: 'boolean' },
    ],
    previewColor: '#f0fdf4',
    description: 'Publication path breadcrumb shown within a result card to provide hierarchy context.',
  },

  'cluster-documents': {
    type: 'cluster-documents',
    label: 'Cluster Documents',
    icon: '📂',
    category: 'search-results',
    canHaveChildren: false,
    defaultProps: {
      maxVisible: 3,
      expandLabel: 'Show more from this topic',
      collapseLabel: 'Show less',
      showPublicationName: true,
    },
    settings: [
      { key: 'maxVisible',         label: 'Initially Visible', type: 'number'  },
      { key: 'expandLabel',        label: 'Expand Label',      type: 'text'    },
      { key: 'collapseLabel',      label: 'Collapse Label',    type: 'text'    },
      { key: 'showPublicationName',label: 'Show Publication',  type: 'boolean' },
    ],
    previewColor: '#dcfce7',
    description: 'Expands additional documents grouped under the same publication/topic cluster in results.',
  },

  // =========================================================================
  // TOPIC TEMPLATE
  // =========================================================================

  'topic-title': {
    type: 'topic-title',
    label: 'Topic Title',
    icon: '📌',
    category: 'topic-template',
    canHaveChildren: false,
    defaultProps: {
      tag: 'h1',
      showPublicationLabel: true,
      clampLines: 0,
    },
    settings: [
      { key: 'tag',                  label: 'HTML Tag',             type: 'select', options: ['h1', 'h2', 'h3', 'div'] },
      { key: 'showPublicationLabel', label: 'Show Publication Label', type: 'boolean' },
      { key: 'clampLines',           label: 'Clamp Lines (0=off)',  type: 'number'  },
    ],
    previewColor: '#fdf4ff',
    description: 'Renders the title of the current topic in the Topic Template page.',
  },

  'topic-metadata': {
    type: 'topic-metadata',
    label: 'Topic Metadata',
    icon: 'ℹ️',
    category: 'topic-template',
    canHaveChildren: false,
    defaultProps: {
      fields: ['type', 'status', 'version', 'author', 'tags'],
      layout: 'inline',
      showIcons: true,
    },
    settings: [
      { key: 'fields',   label: 'Displayed Fields', type: 'array'  },
      { key: 'layout',   label: 'Layout',           type: 'select', options: ['inline', 'vertical', 'grid'] },
      { key: 'showIcons',label: 'Show Icons',       type: 'boolean'},
    ],
    previewColor: '#fdf4ff',
    description: 'Metadata display for a topic (type, status, version, custom fields).',
  },

  'topic-content-display': {
    type: 'topic-content-display',
    label: 'Topic Content Display',
    icon: '📄',
    category: 'topic-template',
    canHaveChildren: false,
    defaultProps: {
      renderHtml: true,
      sanitize: true,
      codeHighlighting: true,
      imageZoom: true,
      maxWidth: 860,
    },
    settings: [
      { key: 'renderHtml',       label: 'Render HTML',         type: 'boolean' },
      { key: 'sanitize',         label: 'Sanitize Output',     type: 'boolean' },
      { key: 'codeHighlighting', label: 'Code Highlighting',   type: 'boolean' },
      { key: 'imageZoom',        label: 'Image Zoom',          type: 'boolean' },
      { key: 'maxWidth',         label: 'Max Width (px)',      type: 'number'  },
    ],
    previewColor: '#fdf4ff',
    description: 'Renders the full HTML body of the current topic in the Topic Template layout.',
  },

  'topic-action-block': {
    type: 'topic-action-block',
    label: 'Topic Action Block',
    icon: '⚡',
    category: 'topic-template',
    canHaveChildren: false,
    defaultProps: {
      actions: ['bookmark', 'share', 'print', 'feedback', 'download-pdf'],
      compact: false,
      position: 'top-right',
    },
    settings: [
      { key: 'actions',  label: 'Enabled Actions', type: 'array'  },
      { key: 'compact',  label: 'Compact Mode',    type: 'boolean'},
      { key: 'position', label: 'Position',        type: 'select', options: ['top-right', 'top-left', 'bottom', 'floating'] },
    ],
    previewColor: '#fdf4ff',
    description: 'Action toolbar for a topic (bookmark, share, print, etc.) in the Topic Template.',
  },

  'topic-admin-tools': {
    type: 'topic-admin-tools',
    label: 'Topic Admin Tools',
    icon: '🛠',
    category: 'topic-template',
    canHaveChildren: false,
    defaultProps: {
      tools: ['edit', 'history', 'permissions', 'analytics'],
      compact: false,
      requireRole: 'admin',
    },
    settings: [
      { key: 'tools',       label: 'Enabled Tools', type: 'array'  },
      { key: 'compact',     label: 'Compact Mode',  type: 'boolean'},
      { key: 'requireRole', label: 'Required Role', type: 'text'   },
    ],
    previewColor: '#fdf4ff',
    description: 'Admin-only toolbar for managing a topic directly from its Template preview.',
  },

  // =========================================================================
  // LINK PREVIEW TEMPLATE
  // =========================================================================

  'lp-title': {
    type: 'lp-title',
    label: 'LP Title',
    icon: '🔗',
    category: 'link-preview',
    canHaveChildren: false,
    defaultProps: {
      tag: 'h2',
      linkable: true,
      clampLines: 2,
    },
    settings: [
      { key: 'tag',        label: 'HTML Tag',        type: 'select', options: ['h1', 'h2', 'h3', 'div', 'span'] },
      { key: 'linkable',   label: 'Linkable',        type: 'boolean' },
      { key: 'clampLines', label: 'Clamp Lines (0=off)', type: 'number' },
    ],
    previewColor: '#f0f9ff',
    description: 'Title of the linked document shown inside a Link Preview hover card.',
  },

  'lp-metadata': {
    type: 'lp-metadata',
    label: 'LP Metadata',
    icon: 'ℹ️',
    category: 'link-preview',
    canHaveChildren: false,
    defaultProps: {
      fields: ['product', 'version', 'updatedAt'],
      separator: '·',
      compact: true,
    },
    settings: [
      { key: 'fields',    label: 'Displayed Fields', type: 'array'  },
      { key: 'separator', label: 'Separator',        type: 'text'   },
      { key: 'compact',   label: 'Compact',          type: 'boolean'},
    ],
    previewColor: '#e0f2fe',
    description: 'Metadata row inside a Link Preview card (product, version, date).',
  },

  'lp-content-preview': {
    type: 'lp-content-preview',
    label: 'LP Content Preview',
    icon: '📃',
    category: 'link-preview',
    canHaveChildren: false,
    defaultProps: {
      maxChars: 200,
      stripHtml: true,
      showEllipsis: true,
    },
    settings: [
      { key: 'maxChars',    label: 'Max Characters', type: 'number'  },
      { key: 'stripHtml',   label: 'Strip HTML',     type: 'boolean' },
      { key: 'showEllipsis',label: 'Show Ellipsis',  type: 'boolean' },
    ],
    previewColor: '#f0f9ff',
    description: 'Text excerpt shown in the Link Preview hover card body.',
  },

  'lp-target-link': {
    type: 'lp-target-link',
    label: 'LP Target Link',
    icon: '↗',
    category: 'link-preview',
    canHaveChildren: false,
    defaultProps: {
      label: 'Read article',
      openInNewTab: false,
      showIcon: true,
    },
    settings: [
      { key: 'label',       label: 'Link Label',    type: 'text'    },
      { key: 'openInNewTab',label: 'New Tab',       type: 'boolean' },
      { key: 'showIcon',    label: 'Show Arrow',    type: 'boolean' },
    ],
    previewColor: '#f0f9ff',
    description: 'CTA link inside the Link Preview card that navigates to the full document.',
  },

  'lp-breadcrumb': {
    type: 'lp-breadcrumb',
    label: 'LP Breadcrumb',
    icon: '›',
    category: 'link-preview',
    canHaveChildren: false,
    defaultProps: {
      separator: '›',
      maxDepth: 2,
      compact: true,
    },
    settings: [
      { key: 'separator', label: 'Separator', type: 'text'    },
      { key: 'maxDepth',  label: 'Max Depth', type: 'number'  },
      { key: 'compact',   label: 'Compact',   type: 'boolean' },
    ],
    previewColor: '#e0f2fe',
    description: 'Compact breadcrumb inside the Link Preview hover card.',
  },
};

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Look up a registry entry by component type.
 * @param {string} type
 * @returns {object|undefined}
 */
export function getComponent(type) {
  return REGISTRY[type];
}

/**
 * Return all registry entries that belong to a given category.
 * @param {string} category
 * @returns {object[]}
 */
export function getComponentsByCategory(category) {
  return Object.values(REGISTRY).filter((entry) => entry.category === category);
}

/**
 * Create a new node for the given component type with a fresh ID,
 * default props, empty style states, and empty children array.
 * @param {string} type
 * @returns {object}  node ready to be inserted into the tree
 */
export function createNode(type) {
  const entry = REGISTRY[type];
  if (!entry) {
    throw new Error(`[designer] createNode: unknown component type "${type}"`);
  }

  return {
    id:       genId(),
    type:     entry.type,
    label:    entry.label,
    props:    entry.defaultProps ? JSON.parse(JSON.stringify(entry.defaultProps)) : {},
    style: {
      base:   {},
      hover:  {},
      focus:  {},
      active: {},
    },
    visibility: {
      condition: 'always',
      value: '',
    },
    children: entry.canHaveChildren ? [] : [],
  };
}
