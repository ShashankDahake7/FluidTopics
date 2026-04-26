'use client';
import { useEffect, useState } from 'react';

// Languages exposed in the profile dropdown.  The dropdown renders the key
// as-is, so each entry is the localized display name of the language.
export const LANGUAGES = ['English', 'Italiano', 'Français', 'Deutsch', 'Español'];

// Translation table — string keys map to per-language values. English is the
// canonical reference; missing keys in other locales fall back to English.
const TRANSLATIONS = {
  English: {
    // ─── Portal header / nav ────────────────────────────────────────────
    home: 'Home',
    community: 'Community',
    support: 'Support',
    academy: 'Academy',
    administration: 'Administration',
    myLibraryNav: 'My Library',
    myAccount: 'My Account',
    manageUsers: 'Manage users',
    analyticsNav: 'Analytics',
    knowledgeHub: 'Knowledge Hub',
    navDesign: 'Design',
    navPortal: 'Portal',
    integrations: 'Integrations',
    myTenant: 'My tenant',
    aboutThisTenant: 'About this tenant',
    notifications: 'Notifications',
    profile: 'Profile',
    searchPreferences: 'Search preferences',
    logOut: 'Log out',
    signInNav: 'Sign In',
    resetYourPassword: 'RESET YOUR PASSWORD',
    resetPasswordLead:
      'If your password is managed internally, you will receive a password reset link.',
    resetPasswordSent: 'If that account exists, a reset link has been sent.',
    resetPasswordError: 'Something went wrong. Please try again.',
    sendResetLinkPrimary: 'Send reset link',

    // ─── Portal home ────────────────────────────────────────────────────
    portalTitle: 'Darwinbox Product Documentation',
    uploadDocument: 'Upload document',
    loadingDocs: 'Loading documentation…',
    noDocsPublished: 'No documentation published yet.',
    noResultsMatch: 'No results match your search.',
    disclaimerLabel: 'Disclaimer',
    disclaimerBody:
      "To help improve user experience, Darwinbox may occasionally request feedback from Darwinbox end users on the features released by Darwinbox using in-app prompts. It's important to note that user feedback will solely focus on feature performance and user experience and will not capture any personal user information. While user feedback will help us enhance the overall user experience, Darwinbox users can still choose not to provide feedback by ignoring/closing such prompts.",

    // ─── Profile page ──────────────────────────────────────────────────
    aboutMe: 'About me',
    name: 'Name',
    emailAddress: 'Email address',
    emailPlaceholder: 'Email',
    lastLogin: 'Last login',
    password: 'Password',
    changePassword: 'Change password',
    contactAdmin: 'To change your password, please contact your administrator.',
    interfacePreferences: 'Interface preferences',
    language: 'Language',
    availableFeatures: 'Available features',
    readerPage: 'Reader page',
    canRate: 'Can rate content',
    canFeedback: 'Can send feedback',
    myLibraryHeading: 'My library',
    canSaveSearches: 'Can save searches',
    canCreateCollections: 'Can create collections',
    currentPassword: 'Current password',
    newPassword: 'New password',
    sixMin: '6 characters minimum',
    cancel: 'Cancel',
    ok: 'OK',
    save: 'Save',
    close: 'Close',

    // ─── My Library tabs ───────────────────────────────────────────────
    bookmarks: 'Bookmarks',
    searches: 'Searches',
    collections: 'Collections',
    noBookmarks: 'No bookmarks',
    noSearches: 'No searches',
    noCollections: 'No collections',
    nothingToSee: 'Nothing to see here',
    goToSearchPage: 'Go to Search page',
    create: 'Create',
    clearAll: 'Clear all',
    createCollection: 'Create a collection',
    editCollection: 'Edit collection',
    editCollectionMeta: 'Rename or change appearance.',
    smartCollectionShort: 'Smart collection',
    smartCollectionLead: 'Topics are filled automatically from your saved search.',
    collectionNotFound: 'Collection not found.',
    collectionTopics: 'Topics in this collection',
    emptyCollectionTopics: 'No topics yet. Open a help article and use “Add to collection”.',
    removeFromCollection: 'Remove from collection',
    backToCollections: '← Collections',
    addToCollection: 'Add to collection',
    addedToCollection: 'Added to collection',
    alreadyInCollection: 'Already in this collection',
    createCollectionFirst: 'Create a manual collection in My Library first.',
    collectionDuplicateTitle: 'A collection with the same title already exists',
    collectionCreateFailedName: 'Failed to create collection \'{name}\'.',
    collectionUpdateFailedName: 'Failed to update collection \'{name}\'.',
    collectionCreatedToast: 'Collection \'{name}\' created.',
    collectionUpdatedToast: 'Collection \'{name}\' updated.',
    collectionDeletedToast: 'Collection \'{name}\' successfully deleted.',
    deleteCollectionQuestion: 'Delete collection "{name}"?',
    delete: 'Delete',
    orderBy: 'Order by',
    filterPlaceholder: 'Filter',
    topicCount: '{n} topic',
    topicCountPlural: '{n} topics',
    enterName: 'Enter a name',
    addDescription: 'Add a description',
    chooseColor: 'Choose a color',
    loading: 'Loading…',

    // ─── Search page ────────────────────────────────────────────────────
    searchPlaceholder: 'Search documentation…',
    resultCount: '{n} result',
    resultCountPlural: '{n} results',
    copyLink: 'COPY LINK',
    saveSearch: 'SAVE SEARCH',
    savedSearch: 'SAVED SEARCH',
    searchScope: 'SEARCH SCOPE',
    contentLanguage: 'Content language',
    contentLangPreferred: 'Match my account',
    contentLangAll: 'All languages',
    searchTitlesOnly: 'Search in document titles only',
    releaseNotes: 'RELEASE_NOTES',
    releaseNotesItem: 'Release Notes',
    module: 'MODULE',
    product: 'PRODUCT',
    noResultsFound: 'No results found',
    tryDifferent: 'Try different keywords or remove filters',
    typeQuery: 'Type a query above to search the documentation.',
    linkCopied: 'Link copied',
    couldNotCopy: 'Could not copy',
    searchSaved: 'Search saved',

    // ─── Doc reader ────────────────────────────────────────────────────
    searchInDocument: 'Search in document',
    expandAll: 'EXPAND ALL',
    collapseAll: 'COLLAPSE ALL',
    searching: 'Searching…',
    noMatchesFor: 'No matches for',
    selectTopic: 'Select a topic from the sidebar.',
    noContentTopic: 'No content available for this topic.',
    allDocs: '← All Docs',
    share: 'Share',
    subscribe: 'Subscribe',
    bookmark: 'Bookmark',
    removeBookmark: 'Remove bookmark',
    feedback: 'Feedback',
    yourRating: 'Your rating',
    poor: 'Poor',
    excellent: 'Excellent',
    feedbackPlaceholder: 'Share your thoughts about this article…',
    submitFeedback: 'SUBMIT FEEDBACK',
    submitting: 'SUBMITTING…',
    thanksFeedback: 'Thanks for your feedback!',
    addedBookmark: 'Added to bookmarks',
    removedBookmark: 'Removed from bookmarks',
    signInBookmark: 'Sign in to bookmark',
    signInCollection: 'Sign in to use collections',
    shareTitle: 'Share the topic URL',
    shareLead: 'Copy and send the link below',
    copy: 'COPY',
    copied: 'COPIED',
    closeUpper: 'CLOSE',
    documentNotFound: 'Document not found.',
    backToPortal: '← Back to portal',
    writtenBy: 'Written by',
    updated: 'Updated',
    inThisSection: 'In this section',

    // ─── Custom templates ─────────────────────────────────────────────
    legalChanges: 'Legal Changes',
    legalChangesLead:
      'This Legal Change page offers an overview of upcoming and existing legal changes. You can explore these changes by year, country, or application component. You can also view the legal changes relevant to your business and their implementation status in your Darwinbox instances.',
    country: 'Country',
    legalInfo: 'Legal Information',
    moduleCol: 'Module',
    lcEffective: 'LC Effective From Date',
    plannedRelease: 'Planned Release Date',
    implementationStatus: 'Implementation Status',
    moreDetails: 'More Details',
    statusImplemented: 'Implemented',
    statusUpcoming: 'Upcoming',
    whatsUpcoming: "What's Upcoming",
    whatsUpcomingBody: "The What's Upcoming content has found a new home.",
    headOverTo: 'Head over to the',
    findLatest: 'to find the latest updates.',
    releaseNotesTitle: 'Release Notes',
    releaseNotesIntro1: 'Darwinbox is passionate about transforming HR Tech!',
    releaseNotesIntro2:
      "Explore Darwinbox's latest updates, enhancements, and bug fixes in our Release Notes for a better HR technology experience.",
    previewProgram: 'Darwinbox Preview Program',
    previewProgramBody:
      'Darwinbox Preview Program offers a structured way for customers and the Product team of Darwinbox to provide and seek feedback on new and upcoming features. For more information, refer',
    faqsTitle: 'Product Documentation FAQs',
    faqsHeading: 'Frequently Asked Questions',
    comingSoon: 'Coming soon…',
    comingSoonBody:
      'Greetings Darwinian! Glad to see you visit this page. Alas, you are a tad bit early. The bards are busy creating the content for this module. Come back in a while!',

    // ─── Footer ───────────────────────────────────────────────────────
    copyrightLine:
      'Copyright ©{year}. Darwinbox Digital Solutions Pvt. Ltd. All Rights Reserved',
  },

  Italiano: {
    home: 'Home',
    community: 'Community',
    support: 'Supporto',
    academy: 'Academy',
    administration: 'Amministrazione',
    myLibraryNav: 'La mia raccolta',
    myAccount: 'Il mio account',
    manageUsers: 'Gestisci utenti',
    notifications: 'Notifiche',
    profile: 'Profilo',
    searchPreferences: 'Preferenze di ricerca',
    logOut: 'Disconnetti',

    portalTitle: 'Documentazione del prodotto Darwinbox',
    uploadDocument: 'Carica documento',
    loadingDocs: 'Caricamento documentazione…',
    noDocsPublished: 'Nessuna documentazione pubblicata.',
    noResultsMatch: 'Nessun risultato corrisponde alla ricerca.',
    disclaimerLabel: 'Disclaimer',
    disclaimerBody:
      "Per migliorare l'esperienza utente, Darwinbox può occasionalmente richiedere feedback agli utenti finali sulle funzionalità rilasciate tramite prompt in-app. È importante notare che il feedback degli utenti si concentrerà esclusivamente sulle prestazioni delle funzionalità e sull'esperienza utente e non raccoglierà alcuna informazione personale. Sebbene il feedback degli utenti contribuirà a migliorare l'esperienza complessiva, gli utenti Darwinbox possono comunque scegliere di non fornire feedback ignorando/chiudendo tali prompt.",

    aboutMe: 'Informazioni su di me',
    name: 'Nome',
    emailAddress: 'Indirizzo e-mail',
    lastLogin: 'Ultimo accesso',
    password: 'Password',
    changePassword: 'Modifica password',
    contactAdmin: 'Per modificare la password, contatta il tuo amministratore.',
    interfacePreferences: 'Preferenze interfaccia',
    language: 'Lingua',
    availableFeatures: 'Funzionalità disponibili',
    readerPage: 'Pagina Lettore',
    canRate: 'È possibile valutare il contenuto',
    canFeedback: 'È possibile inviare feedback',
    myLibraryHeading: 'La mia raccolta',
    canSaveSearches: 'È possibile salvare le ricerche',
    canCreateCollections: 'È possibile creare raccolte',
    currentPassword: 'Password attuale',
    newPassword: 'Nuova password',
    sixMin: 'minimo 6 caratteri',
    cancel: 'Annulla',
    ok: 'OK',
    save: 'Salva',
    close: 'Chiudi',

    bookmarks: 'Segnalibri',
    searches: 'Ricerche',
    collections: 'Raccolte',
    noBookmarks: 'Nessun segnalibro',
    noSearches: 'Nessuna ricerca',
    noCollections: 'Nessuna raccolta',
    nothingToSee: 'Niente da vedere qui',
    goToSearchPage: 'Vai alla pagina di ricerca',
    create: 'Crea',
    clearAll: 'Cancella tutto',
    createCollection: 'Crea una raccolta',
    editCollection: 'Modifica raccolta',
    editCollectionMeta: 'Rinomina o modifica l’aspetto.',
    smartCollectionShort: 'Raccolta intelligente',
    smartCollectionLead: 'Gli argomenti vengono aggiornati automaticamente dalla ricerca salvata.',
    collectionNotFound: 'Raccolta non trovata.',
    collectionTopics: 'Argomenti in questa raccolta',
    emptyCollectionTopics: 'Nessun argomento. Apri un articolo e usa «Aggiungi alla raccolta».',
    removeFromCollection: 'Rimuovi dalla raccolta',
    backToCollections: '← Raccolte',
    addToCollection: 'Aggiungi alla raccolta',
    addedToCollection: 'Aggiunto alla raccolta',
    alreadyInCollection: 'Già presente in questa raccolta',
    createCollectionFirst: 'Crea prima una raccolta manuale in La mia raccolta.',
    collectionDuplicateTitle: 'Esiste già una raccolta con lo stesso titolo',
    collectionCreateFailedName: 'Impossibile creare la raccolta «{name}».',
    collectionUpdateFailedName: 'Impossibile aggiornare la raccolta «{name}».',
    collectionCreatedToast: 'Raccolta «{name}» creata.',
    collectionUpdatedToast: 'Raccolta «{name}» aggiornata.',
    collectionDeletedToast: 'Raccolta «{name}» eliminata correttamente.',
    deleteCollectionQuestion: 'Eliminare la raccolta «{name}»?',
    delete: 'Elimina',
    orderBy: 'Ordina per',
    filterPlaceholder: 'Filtra',
    topicCount: '{n} argomento',
    topicCountPlural: '{n} argomenti',
    enterName: 'Inserisci un nome',
    addDescription: 'Aggiungi una descrizione',
    chooseColor: 'Scegli un colore',
    loading: 'Caricamento…',

    searchPlaceholder: 'Cerca nella documentazione…',
    resultCount: '{n} risultato',
    resultCountPlural: '{n} risultati',
    copyLink: 'COPIA LINK',
    saveSearch: 'SALVA RICERCA',
    savedSearch: 'RICERCA SALVATA',
    searchScope: 'AMBITO DI RICERCA',
    searchTitlesOnly: 'Cerca solo nei titoli dei documenti',
    releaseNotes: 'NOTE_RILASCIO',
    releaseNotesItem: 'Note di rilascio',
    module: 'MODULO',
    product: 'PRODOTTO',
    noResultsFound: 'Nessun risultato trovato',
    tryDifferent: 'Prova parole chiave diverse o rimuovi i filtri',
    typeQuery: 'Digita una query sopra per cercare nella documentazione.',
    linkCopied: 'Link copiato',
    couldNotCopy: 'Impossibile copiare',
    searchSaved: 'Ricerca salvata',

    searchInDocument: 'Cerca nel documento',
    expandAll: 'ESPANDI TUTTO',
    collapseAll: 'COMPRIMI TUTTO',
    searching: 'Ricerca in corso…',
    noMatchesFor: 'Nessun risultato per',
    selectTopic: 'Seleziona un argomento dalla barra laterale.',
    noContentTopic: 'Nessun contenuto disponibile per questo argomento.',
    allDocs: '← Tutti i documenti',
    share: 'Condividi',
    subscribe: 'Iscriviti',
    bookmark: 'Segnalibro',
    removeBookmark: 'Rimuovi segnalibro',
    feedback: 'Feedback',
    yourRating: 'La tua valutazione',
    poor: 'Scarsa',
    excellent: 'Eccellente',
    feedbackPlaceholder: 'Condividi le tue opinioni su questo articolo…',
    submitFeedback: 'INVIA FEEDBACK',
    submitting: 'INVIO…',
    thanksFeedback: 'Grazie per il tuo feedback!',
    addedBookmark: 'Aggiunto ai segnalibri',
    removedBookmark: 'Rimosso dai segnalibri',
    signInBookmark: 'Accedi per aggiungere ai segnalibri',
    signInCollection: 'Accedi per usare le raccolte',
    shareTitle: "Condividi l'URL dell'argomento",
    shareLead: 'Copia e invia il link qui sotto',
    copy: 'COPIA',
    copied: 'COPIATO',
    closeUpper: 'CHIUDI',
    documentNotFound: 'Documento non trovato.',
    backToPortal: '← Torna al portale',
    writtenBy: 'Scritto da',
    updated: 'Aggiornato',
    inThisSection: 'In questa sezione',

    legalChanges: 'Modifiche legali',
    legalChangesLead:
      'Questa pagina Modifiche legali offre una panoramica delle modifiche legali esistenti e in arrivo. Puoi esplorare queste modifiche per anno, paese o componente applicativo. Puoi anche visualizzare le modifiche legali rilevanti per la tua attività e il loro stato di implementazione nelle tue istanze Darwinbox.',
    country: 'Paese',
    legalInfo: 'Informazioni legali',
    moduleCol: 'Modulo',
    lcEffective: 'Data di entrata in vigore LC',
    plannedRelease: 'Data di rilascio pianificata',
    implementationStatus: 'Stato di implementazione',
    moreDetails: 'Maggiori dettagli',
    statusImplemented: 'Implementato',
    statusUpcoming: 'In arrivo',
    whatsUpcoming: 'Prossimamente',
    whatsUpcomingBody: 'I contenuti di Prossimamente hanno trovato una nuova casa.',
    headOverTo: 'Vai alle',
    findLatest: 'per trovare gli ultimi aggiornamenti.',
    releaseNotesTitle: 'Note di rilascio',
    releaseNotesIntro1: 'Darwinbox è appassionata di trasformare la tecnologia HR!',
    releaseNotesIntro2:
      "Esplora gli ultimi aggiornamenti, miglioramenti e correzioni di bug di Darwinbox nelle nostre Note di rilascio per un'esperienza tecnologica HR migliore.",
    previewProgram: 'Programma di anteprima Darwinbox',
    previewProgramBody:
      'Il Programma di anteprima Darwinbox offre un modo strutturato ai clienti e al team di prodotto Darwinbox di fornire e cercare feedback su funzionalità nuove e in arrivo. Per maggiori informazioni, consulta',
    faqsTitle: 'FAQ Documentazione del prodotto',
    faqsHeading: 'Domande frequenti',
    comingSoon: 'Prossimamente…',
    comingSoonBody:
      'Saluti Darwinian! Felici di vederti visitare questa pagina. Ahimè, sei un po\' in anticipo. I bardi sono impegnati a creare il contenuto per questo modulo. Torna tra un po\'!',

    copyrightLine:
      'Copyright ©{year}. Darwinbox Digital Solutions Pvt. Ltd. Tutti i diritti riservati',
  },

  Français: {
    home: 'Accueil',
    community: 'Communauté',
    support: 'Support',
    academy: 'Academy',
    administration: 'Administration',
    myLibraryNav: 'Ma bibliothèque',
    myAccount: 'Mon compte',
    manageUsers: 'Gérer les utilisateurs',
    notifications: 'Notifications',
    profile: 'Profil',
    searchPreferences: 'Préférences de recherche',
    logOut: 'Déconnexion',
    portalTitle: 'Documentation produit Darwinbox',
    uploadDocument: 'Téléverser un document',
    loadingDocs: 'Chargement de la documentation…',
    aboutMe: 'À propos de moi',
    name: 'Nom',
    emailAddress: 'Adresse e-mail',
    lastLogin: 'Dernière connexion',
    password: 'Mot de passe',
    changePassword: 'Modifier le mot de passe',
    contactAdmin: 'Pour modifier votre mot de passe, veuillez contacter votre administrateur.',
    interfacePreferences: "Préférences d'interface",
    language: 'Langue',
    availableFeatures: 'Fonctionnalités disponibles',
    readerPage: 'Page de lecture',
    canRate: 'Peut noter le contenu',
    canFeedback: 'Peut envoyer un commentaire',
    myLibraryHeading: 'Ma bibliothèque',
    canSaveSearches: 'Peut enregistrer les recherches',
    canCreateCollections: 'Peut créer des collections',
    currentPassword: 'Mot de passe actuel',
    newPassword: 'Nouveau mot de passe',
    sixMin: '6 caractères minimum',
    cancel: 'Annuler',
    ok: 'OK',
    bookmarks: 'Signets',
    searches: 'Recherches',
    collections: 'Collections',
    noBookmarks: 'Aucun signet',
    noSearches: 'Aucune recherche',
    noCollections: 'Aucune collection',
    nothingToSee: 'Rien à voir ici',
    goToSearchPage: 'Aller à la recherche',
    create: 'Créer',
    searchPlaceholder: 'Rechercher dans la documentation…',
    expandAll: 'TOUT DÉVELOPPER',
    collapseAll: 'TOUT RÉDUIRE',
    searchInDocument: 'Rechercher dans le document',
    yourRating: 'Votre évaluation',
    poor: 'Mauvais',
    excellent: 'Excellent',
    submitFeedback: 'ENVOYER LE COMMENTAIRE',
    feedback: 'Commentaire',
  },

  Deutsch: {
    home: 'Startseite',
    community: 'Community',
    support: 'Support',
    academy: 'Academy',
    administration: 'Verwaltung',
    myLibraryNav: 'Meine Bibliothek',
    myAccount: 'Mein Konto',
    profile: 'Profil',
    aboutMe: 'Über mich',
    name: 'Name',
    emailAddress: 'E-Mail-Adresse',
    lastLogin: 'Letzte Anmeldung',
    password: 'Passwort',
    changePassword: 'Passwort ändern',
    interfacePreferences: 'Benutzeroberflächeneinstellungen',
    language: 'Sprache',
    availableFeatures: 'Verfügbare Funktionen',
    readerPage: 'Leseseite',
    canRate: 'Inhalt bewerten',
    canFeedback: 'Feedback senden',
    myLibraryHeading: 'Meine Bibliothek',
    canSaveSearches: 'Suchen speichern',
    canCreateCollections: 'Sammlungen erstellen',
    currentPassword: 'Aktuelles Passwort',
    newPassword: 'Neues Passwort',
    sixMin: 'Mindestens 6 Zeichen',
    cancel: 'Abbrechen',
    ok: 'OK',
    bookmarks: 'Lesezeichen',
    searches: 'Suchen',
    collections: 'Sammlungen',
    nothingToSee: 'Hier gibt es nichts zu sehen',
    yourRating: 'Ihre Bewertung',
    poor: 'Schlecht',
    excellent: 'Ausgezeichnet',
  },

  Español: {
    home: 'Inicio',
    community: 'Comunidad',
    support: 'Soporte',
    academy: 'Academia',
    administration: 'Administración',
    myLibraryNav: 'Mi biblioteca',
    myAccount: 'Mi cuenta',
    profile: 'Perfil',
    aboutMe: 'Acerca de mí',
    name: 'Nombre',
    emailAddress: 'Dirección de correo electrónico',
    lastLogin: 'Último acceso',
    password: 'Contraseña',
    changePassword: 'Cambiar contraseña',
    interfacePreferences: 'Preferencias de interfaz',
    language: 'Idioma',
    availableFeatures: 'Funciones disponibles',
    readerPage: 'Página de lectura',
    canRate: 'Puede calificar contenido',
    canFeedback: 'Puede enviar comentarios',
    myLibraryHeading: 'Mi biblioteca',
    canSaveSearches: 'Puede guardar búsquedas',
    canCreateCollections: 'Puede crear colecciones',
    currentPassword: 'Contraseña actual',
    newPassword: 'Nueva contraseña',
    sixMin: 'mínimo 6 caracteres',
    cancel: 'Cancelar',
    ok: 'OK',
    bookmarks: 'Marcadores',
    searches: 'Búsquedas',
    collections: 'Colecciones',
    nothingToSee: 'Nada que ver aquí',
    yourRating: 'Tu valoración',
    poor: 'Mala',
    excellent: 'Excelente',
  },
};

const STORAGE_KEY = 'ft_lang';
const EVENT = 'ft-lang-change';

/** ISO 639-1 (or primary tag) → UI language label used in LANGUAGES. */
const ISO_TO_UI = {
  en: 'English',
  it: 'Italiano',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
};

const UI_TO_ISO = Object.fromEntries(
  Object.entries(ISO_TO_UI).map(([iso, label]) => [label, iso])
);

export function isoToUiLanguage(iso) {
  if (!iso || typeof iso !== 'string') return 'English';
  const key = iso.trim().toLowerCase().split('-')[0];
  return ISO_TO_UI[key] || 'English';
}

export function uiLanguageToIso(ui) {
  return UI_TO_ISO[ui] || 'en';
}

/** After login / profile load — align UI strings with User.preferences.language. */
export function syncUiLanguageFromUser(user) {
  const iso = user?.preferences?.language;
  if (!iso) return;
  const ui = isoToUiLanguage(iso);
  if (LANGUAGES.includes(ui)) setStoredLanguage(ui);
}

export function getStoredLanguage() {
  if (typeof window === 'undefined') return 'English';
  const v = localStorage.getItem(STORAGE_KEY);
  return LANGUAGES.includes(v) ? v : 'English';
}

export function setStoredLanguage(lang) {
  if (typeof window === 'undefined') return;
  if (!LANGUAGES.includes(lang)) return;
  localStorage.setItem(STORAGE_KEY, lang);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: lang }));
}

// React hook — re-renders any consumer when the language changes anywhere.
// Returns a `t(key, vars?)` helper that does {placeholder} substitution and
// falls back to English (then the raw key) when a translation is missing.
export function useTranslation() {
  const [lang, setLang] = useState('English');

  useEffect(() => {
    setLang(getStoredLanguage());
    const onChange = () => setLang(getStoredLanguage());
    window.addEventListener(EVENT, onChange);
    window.addEventListener('storage', onChange);

    const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';
    if (!localStorage.getItem(STORAGE_KEY)) {
      fetch(`${API_BASE}/languages/default`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!d?.defaultLocale || localStorage.getItem(STORAGE_KEY)) return;
          const ui = isoToUiLanguage(d.defaultLocale);
          if (LANGUAGES.includes(ui)) setStoredLanguage(ui);
        })
        .catch(() => {});
    }

    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, []);

  const dict = TRANSLATIONS[lang] || TRANSLATIONS.English;
  const t = (key, vars) => {
    let s = dict[key] ?? TRANSLATIONS.English[key] ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
      }
    }
    return s;
  };
  return { t, lang, setLang: setStoredLanguage };
}
