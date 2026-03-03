import { create } from 'zustand';

// ── Language store ────────────────────────────────────────────────────────────
type Lang = 'en' | 'es';

interface LangState {
  lang: Lang;
  setLang: (l: Lang) => void;
}

export const useLangStore = create<LangState>((set) => ({
  lang: (localStorage.getItem('ecu-lang') as Lang) ?? 'en',
  setLang: (lang) => {
    localStorage.setItem('ecu-lang', lang);
    set({ lang });
  },
}));

// ── Translations ──────────────────────────────────────────────────────────────
const T = {
  en: {
    // ── Navbar
    sessions: 'Sessions',
    logout: 'Logout',
    users: 'Users',
    viewProfile: 'View profile',
    stationWorkbench: 'Station Workbench →',
    language: 'Language',

    // ── SessionDashboard
    flashSessions: 'Flash Sessions',
    newSession: '+ New Session',
    colName: 'Name',
    colSwVersion: 'SW Version',
    colStatus: 'Status',
    colCreated: 'Created',
    openSession: 'Open →',
    deleteSession: 'Delete',
    noSessions: 'No sessions yet',
    confirmDeleteSession: (n: string) =>
      `Delete session "${n}"?\nAll boxes, ECUs and associated data will be deleted.`,
    newFlashSession: 'New Flash Session',
    sessionName: 'Session Name',
    targetSwVersion: 'Target SW Version',
    savedTemplates: 'Saved templates:',
    deleteTemplate: 'Delete template',
    saveAsTemplate: 'Save as Template',
    saveTemplatePre: '📋 Save Template',
    saveTemplateDesc: 'Saves: name and SW version of this session to prefill future sessions.',
    templateLabel: 'Template name',
    cancel: 'Cancel',
    save: 'Save',
    create: 'Create',
    creating: 'Creating…',
    saving: 'Saving…',

    // ── Session detail — session controls
    markReady: 'Mark Ready',
    startSession: 'Start Session',
    closeSession: 'Close Session',
    reopenSession: '⚠️ Reopen Session',

    // ── Session detail — tabs
    tabBoxes: 'Boxes',
    tabStations: 'Stations',
    tabAnalytics: 'Analytics',

    // ── Box filter bar
    searchBox: 'Search box…',
    statusAll: 'All',
    statusInProgress: 'In Progress',
    withIssues: '⚠ With Issues',
    allStations: 'All stations',
    noStation: 'No station',
    sortName: 'Sort: Name',
    sortCreated: 'Sort: Created',
    sortCompleted: 'Sort: Completed',
    sortEcus: 'Sort: ECUs',
    sortIssues: 'Sort: Issues',
    addBox: '+ Add Box',
    noBoxesMatch: 'No boxes match the current filters.',

    // ── Box grid card
    frozenYes: 'Yes',
    frozenNo: 'No',
    failedLabel: 'failed',
    scratchLabel: 'scratch',
    completedAt: 'Completed',

    // ── AddBox modal
    addBoxTitle: 'Add Box',
    boxSerial: 'Box Serial',
    expectedEcuCount: 'Expected ECU Count (optional)',
    addBoxBtn: 'Add Box',

    // ── Stations tab
    addStation: '+ Add Station',
    stationMembers: 'Members',
    stationNone: 'None',
    noStations: 'No stations yet.',
    workbenchLink: 'Workbench →',

    // ── Add Station modal
    newStation: 'New Station',
    stationNameLabel: 'Station Name',
    assignMembers: 'Assign Members',
    addStationBtn: 'Add Station',

    // ── Workbench — select station
    selectYourStation: 'Select Your Station',
    noMembers: 'No members',
    continueBox: '→ continue',
    noStationsMsg: 'No stations. Ask an admin to create stations first.',

    // ── Workbench — scan box
    scanBoxSerial: 'Scan / Enter Box Serial',
    changeStation: 'Change Station',
    claimBtn: 'Claim',

    // ── Workbench — learning
    learningTitle: (serial: string) => `Learning: ${serial}`,
    ecusScanCount: (n: number) => `${n} ECUs scanned`,
    freezeInventory: (n: number) => `🔒 Freeze Inventory (${n})`,
    scanEcuPlaceholder: 'Scan ECU barcode…',
    addEcuBtn: 'Add',
    colHash: '#',
    colEcuCode: 'ECU Code',
    colEcuStatus: 'Status',
    scanEcusTip: 'Scan ECUs to begin',

    // ── Workbench — flashing table
    flashingTitle: (serial: string) => `Flashing: ${serial}`,
    doneCount: (done: number, total: number) => `${done}/${total} done`,
    colStatusTime: 'Status / Time',
    colAttempts: 'Attempts',
    colResult: 'Result',
    colNotes: 'Notes',
    colAction: 'Action',
    resultSuccess: 'Success',
    resultFailed: 'Failed',
    startFlash: 'Start Flash',
    finishFlash: 'Finish',
    rework: 'Rework',
    scratchBtn: '🗑 Scratch',
    reFlash: 'Re-Flash',

    // ── Workbench — blocked
    boxBlocked: 'Box Blocked',
    boxBlockedMsg: (serial: string) =>
      `${serial} — one or more ECUs failed. Rework failed units to unblock.`,
    viewFlashTable: 'View Flash Table',

    // ── Workbench — completed
    boxCompleted: 'Box Completed!',
    boxCompletedMsg: (serial: string, n: number) =>
      `${serial} — all ${n} ECUs flashed successfully.`,
    scanNextBox: 'Scan Next Box',

    // ── Profile modal
    profileData: 'Profile data',
    profileNameLabel: 'Name',
    profileEmailLabel: 'Email address',
    saveChanges: 'Save changes',
    changePassword: 'Change Password',
    currentPassword: 'Current Password',
    newPasswordLabel: 'New Password',
    confirmNewPassword: 'Confirm new',
    changePasswordBtn: 'Change password',
    changingPassword: 'Changing…',
    changePhoto: '📷 Change photo',
    removePhoto: 'Remove photo',
    profileUpdated: 'Profile updated successfully.',
    passwordChanged: 'Password changed successfully.',
    photoUpdated: 'Photo updated.',
    photoRemoved: 'Photo removed.',
    photoTooLarge: 'Image must not exceed 1.5 MB.',
    passwordsNoMatch: 'New passwords do not match.',
    passwordTooShort: 'New password must be at least 6 characters.',
    currentPasswordRequired: 'current_password is required to set a new password',
    joinedSince: 'since',
    minChars: 'min. 6 characters',
    repeatPwd: 'repeat password',

    // ── Role labels
    roleAdmin: 'Admin',
    roleTech: 'Technician',
    roleViewer: 'Viewer',

    // ── User management modal
    userMgmtTitle: '👤 User Management',
    newUser: '➕ New user',
    editingUser: (name: string) => `✏️ Editing: ${name}`,
    nameLabel: 'Name',
    emailLabel: 'Email',
    passwordLabel: 'Password',
    passwordOptional: 'Password (leave blank to keep)',
    roleLabel: 'Role',
    saveUserBtn: 'Save',
    savingBtn: 'Saving…',
    resetBtn: 'Reset',
    confirmDeleteUser: (name: string) =>
      `Delete ${name}? This action cannot be undone.`,
    nameEmailRequired: 'Name and email are required.',
    passwordRequiredNew: 'Password is required for new users.',
    colUserName: 'Name',
    colUserEmail: 'Email',
    colUserRole: 'Role',
    colUserActions: 'Actions',
  },

  es: {
    // ── Navbar
    sessions: 'Sesiones',
    logout: 'Cerrar sesión',
    users: 'Usuarios',
    viewProfile: 'Ver perfil',
    stationWorkbench: 'Estación de trabajo →',
    language: 'Idioma',

    // ── SessionDashboard
    flashSessions: 'Sesiones de Flasheo',
    newSession: '+ Nueva Sesión',
    colName: 'Nombre',
    colSwVersion: 'Versión SW',
    colStatus: 'Estado',
    colCreated: 'Creada',
    openSession: 'Abrir →',
    deleteSession: 'Borrar',
    noSessions: 'Sin sesiones',
    confirmDeleteSession: (n: string) =>
      `¿Eliminar la sesión "${n}"?\nSe borrarán también todas las cajas, ECUs y datos asociados.`,
    newFlashSession: 'Nueva Sesión de Flasheo',
    sessionName: 'Nombre de la sesión',
    targetSwVersion: 'Versión SW objetivo',
    savedTemplates: 'Templates guardados:',
    deleteTemplate: 'Eliminar template',
    saveAsTemplate: 'Guardar como Template',
    saveTemplatePre: '📋 Guardar Template',
    saveTemplateDesc: 'Guarda el nombre y versión SW de esta sesión para precargar sesiones futuras.',
    templateLabel: 'Nombre del template',
    cancel: 'Cancelar',
    save: 'Guardar',
    create: 'Crear',
    creating: 'Creando…',
    saving: 'Guardando…',

    // ── Session detail — session controls
    markReady: 'Marcar lista',
    startSession: 'Iniciar sesión',
    closeSession: 'Cerrar sesión',
    reopenSession: '⚠️ Reabrir Sesión',

    // ── Session detail — tabs
    tabBoxes: 'Cajas',
    tabStations: 'Estaciones',
    tabAnalytics: 'Análisis',

    // ── Box filter bar
    searchBox: 'Buscar caja…',
    statusAll: 'Todos',
    statusInProgress: 'En proceso',
    withIssues: '⚠ Con fallas',
    allStations: 'Todas las estaciones',
    noStation: 'Sin estación',
    sortName: 'Ordenar: Nombre',
    sortCreated: 'Ordenar: Fecha',
    sortCompleted: 'Ordenar: Completada',
    sortEcus: 'Ordenar: ECUs',
    sortIssues: 'Ordenar: Fallas',
    addBox: '+ Agregar Caja',
    noBoxesMatch: 'No hay cajas que coincidan.',

    // ── Box grid card
    frozenYes: 'Sí',
    frozenNo: 'No',
    failedLabel: 'fallidas',
    scratchLabel: 'scratch',
    completedAt: 'Completada',

    // ── AddBox modal
    addBoxTitle: 'Agregar Caja',
    boxSerial: 'Serie de la Caja',
    expectedEcuCount: 'ECUs esperadas (opcional)',
    addBoxBtn: 'Agregar Caja',

    // ── Stations tab
    addStation: '+ Agregar Estación',
    stationMembers: 'Miembros',
    stationNone: 'Ninguno',
    noStations: 'Sin estaciones.',
    workbenchLink: 'Estación →',

    // ── Add Station modal
    newStation: 'Nueva Estación',
    stationNameLabel: 'Nombre de la Estación',
    assignMembers: 'Asignar Miembros',
    addStationBtn: 'Agregar Estación',

    // ── Workbench — select station
    selectYourStation: 'Selecciona tu Estación',
    noMembers: 'Sin miembros',
    continueBox: '→ continuar',
    noStationsMsg: 'No hay estaciones. Pide al admin que cree estaciones primero.',

    // ── Workbench — scan box
    scanBoxSerial: 'Escanear / Ingresar Serie de la Caja',
    changeStation: 'Cambiar Estación',
    claimBtn: 'Reclamar',

    // ── Workbench — learning
    learningTitle: (serial: string) => `Aprendizaje: ${serial}`,
    ecusScanCount: (n: number) => `${n} ECUs escaneadas`,
    freezeInventory: (n: number) => `🔒 Congelar Inventario (${n})`,
    scanEcuPlaceholder: 'Escanear código de ECU…',
    addEcuBtn: 'Agregar',
    colHash: '#',
    colEcuCode: 'Código ECU',
    colEcuStatus: 'Estado',
    scanEcusTip: 'Escanea ECUs para comenzar',

    // ── Workbench — flashing table
    flashingTitle: (serial: string) => `Flasheando: ${serial}`,
    doneCount: (done: number, total: number) => `${done}/${total} listas`,
    colStatusTime: 'Estado / Tiempo',
    colAttempts: 'Intentos',
    colResult: 'Resultado',
    colNotes: 'Notas',
    colAction: 'Acción',
    resultSuccess: 'Éxito',
    resultFailed: 'Fallo',
    startFlash: 'Iniciar Flash',
    finishFlash: 'Finalizar',
    rework: 'Retrabajo',
    scratchBtn: '🗑 Descartar',
    reFlash: 'Re-Flashear',

    // ── Workbench — blocked
    boxBlocked: 'Caja Bloqueada',
    boxBlockedMsg: (serial: string) =>
      `${serial} — una o más ECUs fallaron. Retrabajar las unidades fallidas para desbloquear.`,
    viewFlashTable: 'Ver tabla de flasheo',

    // ── Workbench — completed
    boxCompleted: '¡Caja Completada!',
    boxCompletedMsg: (serial: string, n: number) =>
      `${serial} — las ${n} ECUs fueron flasheadas exitosamente.`,
    scanNextBox: 'Escanear siguiente caja',

    // ── Profile modal
    profileData: 'Datos del perfil',
    profileNameLabel: 'Nombre',
    profileEmailLabel: 'Correo electrónico',
    saveChanges: 'Guardar cambios',
    changePassword: 'Cambiar contraseña',
    currentPassword: 'Contraseña actual',
    newPasswordLabel: 'Nueva contraseña',
    confirmNewPassword: 'Confirmar nueva',
    changePasswordBtn: 'Cambiar contraseña',
    changingPassword: 'Cambiando…',
    changePhoto: '📷 Cambiar foto',
    removePhoto: 'Eliminar foto',
    profileUpdated: 'Perfil actualizado correctamente.',
    passwordChanged: 'Contraseña cambiada correctamente.',
    photoUpdated: 'Foto actualizada.',
    photoRemoved: 'Foto eliminada.',
    photoTooLarge: 'La imagen no debe superar 1.5 MB.',
    passwordsNoMatch: 'Las contraseñas nuevas no coinciden.',
    passwordTooShort: 'La nueva contraseña debe tener al menos 6 caracteres.',
    currentPasswordRequired: 'current_password is required to set a new password',
    joinedSince: 'desde',
    minChars: 'mín. 6 caracteres',
    repeatPwd: 'repite la contraseña',

    // ── Role labels
    roleAdmin: 'Admin',
    roleTech: 'Técnico',
    roleViewer: 'Visualizador',

    // ── User management modal
    userMgmtTitle: '👤 Gestión de Usuarios',
    newUser: '➕ Nuevo usuario',
    editingUser: (name: string) => `✏️ Editando: ${name}`,
    nameLabel: 'Nombre',
    emailLabel: 'Correo',
    passwordLabel: 'Contraseña',
    passwordOptional: 'Contraseña (dejar en blanco para no cambiar)',
    roleLabel: 'Rol',
    saveUserBtn: 'Guardar',
    savingBtn: 'Guardando…',
    resetBtn: 'Resetear',
    confirmDeleteUser: (name: string) =>
      `¿Eliminar a ${name}? Esta acción no se puede deshacer.`,
    nameEmailRequired: 'Nombre y email son requeridos.',
    passwordRequiredNew: 'La contraseña es requerida para nuevos usuarios.',
    colUserName: 'Nombre',
    colUserEmail: 'Correo',
    colUserRole: 'Rol',
    colUserActions: 'Acciones',
  },
} as const;

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useT() {
  const lang = useLangStore(s => s.lang);
  return T[lang];
}
