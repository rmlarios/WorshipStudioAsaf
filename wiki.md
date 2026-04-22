# WorshipStudio Asaf 148 - Documentación (Wiki)

Bienvenido a la documentación oficial y bitácora de desarrollo de **WorshipStudio Asaf**. Esta aplicación web nació con la necesidad de simplificar y reemplazar el tedioso flujo de Excel que la iglesia utilizaba mensualmente para planificar a cantores, músicos y armar los setlists bíblicos de adoración.

---

## 🏗️ Arquitectura Técnica

- **Framework**: Next.js (App Router), React, TypeScript.
- **Estilos**: Tailwind CSS combinado con Lucide React para iconografía.
- **Base de Datos**: Google Firebase Firestore (NoSQL en la nube). La lógica de acceso vive en `src/lib/firebaseStore.ts` con funciones `async/await` que operan sobre colecciones (`users`, `serviceDates`, `availabilities`, `library`, `settings`).
- **Autenticación**: Login por nombre de usuario y contraseña almacenados en Firestore (sin Firebase Auth). Los Directores gestionan las cuentas desde el panel de Miembros.
- **Gestión de Datos Internos**: Todo el esquema vive en `src/lib/types.ts` dictando cómo es un *Usuario*, un *Culto (ServiceDate)*, y la *Biblioteca Musical (LibrarySong)*.
- **Exportaciones**:
  - `xlsx` - Excel oficial en base de cuadrícula mensual.
  - `jspdf` y `jspdf-autotable` - Reportes súper estilizados en PDF con formato de tarjetas ideales interactivas.

---

## 🛠️ Historial de Desarrollo (Fases)

### Fase 1: Transición del Excel al Web UI
**Objetivo:** Crear una interfaz amigable que permitiera recrear el mes en un clic, eliminando el copy-paste de celdas.
- **Roles y Autenticación:** Se construyó un Mock-login para aislar "Directores" (Admins), de "Cantores" y "Músicos". 
- **Generador de Semanas:** En Settings (Ajustes) puedes elegir tus días por defecto (Ej: martes y domingo) para crear el mes en un segundo.
- **El Dashboard:** Una matriz de Tarjetas por cada día donde todos pueden ver, en base a su rol, las personas disponibles y bloquear el registro.

### Fase 2: Control, Flujo y Tareas Musicales
**Objetivo:** Gestionar qué vocales cantan qué canción en lugar de solo listar títulos.
- **Estados de Bosquejo:** Se añadió un flujo DRAFT (Borrador) -> REVIEW (Revisión) -> APPROVED (Aprobado). Obligando a que los admin le den "El Visto Bueno" a los líderes de día antes de publicarlo al grupo.
- **Director y Solistas:** El Director general elige un "Director de Día" que armará la lista; este puede elegir asignar qué Acompañante cantará de voz Líder (Solista o Unísono).
- **Indicador de Disponibilidad ("Quién va")**: Los usuarios cantores observan públicamente en el Dashboard de Cultos quiénes de sus compañeros ya confirmaron asistencia para saber con quién pueden ensamblar coros.

### Fase 3: La Biblioteca Musical Global & Usabilidad
**Objetivo:** Eliminar la fricción de escritura manual de la app con un catálogo preconstruido y facilidad motriz.
- **Repertorio Asaf**: Se creó un repositorio mundial interno (`Library`) que captura automáticamente cualquier canción que un Director de día registre. Si le ponen Tono la adjuntan historial, si no, se va como "*Desconocido*".
- **Búsqueda Mágica**: Si alguien sube guitarra pero no se sabe el Tono (Desconocido), aparece un botón directo para buscar la progresión de acordes en Google basándose en artista y título.
- **Drag & Drop**: Implementación 100% nativa (Drag HTML5) para reordenamiento de canciones sin usar frameworks pesados que ralenticen celulares, vital en edición del día.
- **Motor PDF Estilizado**: Transformamos la burda tabla de Excel en tarjetas "cards PDF" oscuras y modernas dividiendo cantante y solista listas de descargas grupales.

### Fase 4: Autocompletado, Prevención de Repeticiones y CRUD de Biblioteca
**Objetivo:** Hacer el sistema robusto, limpio y proactivo (Inteligente).
- **Control Directo**: El Panel de Repertorio permite al Director agregar canciones directamente con `+ Añadir Canción`, y editar campos si se registró con errores de dedo en algún culto.
- **Autocompletado Proactivo**: Al digitar un título en la ventana de "Añadir a Culto", un Dropdown en vivo cruza la información de la Biblioteca y rellena automáticamente todo el formulario (Tono / Youtube / Artista).
- **Protección Anti-Duplicados**: El cruce de información escanea además si esa canción se utilizará este mismo Mes y despliega la advertencia: *"Advertencia: Ya se usó este mes en: Domingo 1"*, para forzar rotación de repertorios y variedad.

### Fase 5: Vistas de Alta Densidad (Matriz Vocal) [COMPLETADO ✅]
**Objetivo:** Dar al usuario administrativo una vista rápida y masiva de todo el repositorio sin interactuar demasiado.
- **Toggle Cards/Tabla:** Se incrustó un control de visualización en el Panel de Repertorio que permite oscilar entre tarjetas enriquecidas (Móviles) y una Tabla de datos clásicos (PC/Laptop).
- **Matriz Cruzada Dinámica:** En la vista de tabla, el sistema extrae automáticamente la lista de todos los `Usuarios` con Rol=`CANTOR` para crear N columnas infinitas hacia la derecha.
- **Cruce de Tonos:** Al escanear una fila (canción), la tabla marca en la celda cruzada bajo el nombre de cada miembro el **Tono Vocal** guardado para esa persona. Generando un panorama matricial perfecto idéntico a las hojas de Excel administrativas masivas.
- **Edición Inline de Tonos:** Cada cantor puede editar directamente en la tabla el tono de su columna personal (los Directores pueden editar cualquier columna) con un clic sobre la celda, escribir y guardar sin navegar a otro formulario.

### Fase 6: Migración a Firebase Real + Login con Contraseña + Gestión de Miembros
**Objetivo:** Llevar la aplicación de una simulación local (localStorage) a una Base de Datos real en la nube (Google Firestore), permitiendo acceso multiusuario simultáneo desde cualquier dispositivo.
- **Firebase Firestore:** Se reemplazó completamente `MockFirebaseDB` (localStorage) por funciones `async/await` que hablan directamente con colecciones de Firestore (`users`, `serviceDates`, `availabilities`, `library`, `settings`).
- **Login con Contraseña:** La pantalla de inicio ahora solicita *Nombre de Usuario* y *Contraseña*, validados contra la colección `users` de Firestore. No se almacena la contraseña en la sesión local del navegador.
- **Seed Automático:** La primera vez que la app se conecta a un Firestore vacío, crea automáticamente los usuarios iniciales del equipo con contraseñas predeterminadas.
- **Panel de Miembros (`/dashboard/members`):** Nueva sección exclusiva para Directores que permite:
  - **Crear** nuevos miembros (nombre, usuario, contraseña, rol).
  - **Editar** cualquier dato de un miembro existente.
  - **Deshabilitar/Rehabilitar** el acceso de un miembro (sin eliminarlo de registros históricos).
  - **Eliminar** permanentemente un miembro, pero **solo** si no está referenciado en ningún culto ni en el repertorio. Si lo está, el sistema muestra exactamente dónde aparece y sugiere deshabilitar en su lugar.
  - **Ver/Ocultar Contraseñas** de cada miembro con un botón de ojo.
  - **Tooltips** descriptivos en cada botón de acción para guiar al Director.
- **Navegación:** Se agregó el enlace "Miembros" con ícono de grupo en la barra lateral/inferior solo para Directores.

---

### Fase 7: Planificación Mensual Interactiva y Masiva (Matrix View V2)
**Objetivo:** Centralizar y agilizar milimétricamente la toma de decisiones administrativas del mes entero en una sola pantalla.
- **Matriz de Alta Densidad:** Nueva vista `/dashboard/matrix` exclusiva para Directores que cruza a todos los Miembros vs todos los Cultos del mes.
- **Asignación Quick-Assign:** Implementación de un Modal interactivo que permite fijar quién **Preside (Líder)** y quién **Acompaña (Coro)** con un solo click sobre la celda del usuario.
- **Indicadores de Salud (Dashboarding):** La matriz calcula y muestra visualmente la carga de trabajo de los miembros (cuántos días disponibles vs asignados tienen en el mes). Además alerta en la cabecera del culto si le falta asignar un líder y si ya cuentan con canciones programadas.
- **Ajuste de Emergencia:** Los directores pueden forzar la anulación o activación de la disponibilidad de un usuario sobreescribiendo sus respuestas desde el mini-modal individual sin salir de la matriz.
- **Editor Masivo (Bulk Editor):** Al dar clic en una fecha, se despliega un gran panel que lista a TODO el equipo permitiendo, mediante interruptores interactivos (switches), definir quién está disponible, y asignar múltiples roles simultáneos a varias personas guardando una configuración completa entera del culto en un solo envío a la base de datos.
- **Diseño de Vanguardia:** Uso de *Glassmorphism*, opacidades inteligentes para inactividades, redondos modernos y códigos de colores vibrantes para una lectura visual instantánea del estado del mes.

---

### Fase 8: Refactor de Vista Previa, Reportes Centralizados y Pulido UX [COMPLETADO ✅]
**Objetivo:** Eliminar redundancia de código, unificar la identidad visual y facilitar el acceso a reportes desde cualquier punto clave.
- **SetlistPreview Reutilizable**: Se extrajo la lógica del modal de "Vista Previa estilo WhatsApp" a un componente independiente y altamente configurable. Ahora, el mismo código renderiza la vista previa en el Dashboard, la Matriz y la pantalla de Detalles, asegurando consistencia total.
- **Acceso Rápido (Eye Icon)**: Se añadió un botón de "Ojo" directo en las tarjetas del Dashboard. Los miembros pueden ver las canciones y tonos de un culto sin necesidad de entrar a la pantalla de detalles, ahorrando clics.
- **Estética de Vanguardia**: Refinamiento visual del modal con efectos de *Glassmorphism* (desenfoque de fondo), reflejos metalizados en el encabezado, bordes con brillo tipo *Rim-Light* y animaciones de entrada suaves para una experiencia premium.
- **Exportación Centralizada**: Toda la lógica de generación de PDF (jsPDF) y Excel (XLSX) fue movida a un utilitario común (`exportUtils.ts`).
- **Botones de Reporte Everywhere**: Se integraron botones de "Exportar PDF" con indicadores de carga tanto en la cabecera del Dashboard como en la Matriz de Planificación, permitiendo a los Directores descargar el bosquejo oficial desde donde estén trabajando.
- **Corrección de Timezone**: Se solucionó un bug crítico donde el exportador de reportes mostraba el mes anterior (desfase de -1) debido a la interpretación UTC de JavaScript; ahora se utiliza `parseISO` para garantizar que el mes coincida siempre con el dato local.
- **Pulido de Identidad**: Actualización de metadatos del sitio (Título ASAF WorshipStudio), integración de logotipo oficial en el login y aplicación de cursor interactivo global en todos los botones para mejorar la respuesta táctil.

---

### Fase 9: Rediseño Visual Premium de la Matriz y Branding Asaf 148 [COMPLETADO ✅]
**Objetivo:** Elevar la identidad visual de la plataforma al nivel de herramientas profesionales de producción musical, unificando el branding bajo el nombre "Asaf 148" y actualizando la documentación.

- **Renombre de Marca**: La plataforma ahora se identifica globalmente como **WorshipStudio Asaf 148**, reflejado en el título de la pestaña (`metadata`), la pantalla de login, la Wiki y el Manual de Usuario.
- **Logo Oficial**: Se generó e integró un logotipo profesional (PNG con fondo transparente, efectos de `drop-shadow` neon) en la pantalla de autenticación. Resuelto bug 404 al posicionar correctamente el archivo en `/public/logo.png`.
- **Rediseño de la Matriz (SynchroDash Style)**:
  - **Avatares de Equipos**: Se añadieron avatares circulares con iniciales de colores únicos por persona, construidos dinámicamente sin dependencias externas.
  - **Celdas con Neon Glow**: Cada estado de asignación ahora tiene su propio efecto de resplandor de color (amarillo para *Encargado*, rosa para *Coro*, azul para *Músico*, verde para *Disponible*), usando clases globales `glow-*` e `icon-glow-*` definidas en `globals.css`.
  - **Iconografía Premium**: Reemplazo de `Star` por `Crown` (corona) para los líderes del día. Uso de `CheckCircle2` para cantores disponibles y `Music` para músicos, alineando los íconos con su semántica real.
  - **Glassmorphism en Modales**: Ambos modales (Asignación y Editor Masivo) ahora usan `backdrop-blur`, fondos translúcidos y sombras de color para dar una sensación de profundidad y premiumness.
  - **Leyenda Visual Mejorada**: La barra de leyenda inferior usa los mismos efectos de color que las celdas para ser autodocumentada.
- **Manual de Usuario v2.0**:
  - Actualizado el documento `MANUAL_USUARIO.md` con todas las nuevas secciones: Matriz de Planificación, Editor Masivo, Vista Previa Rápida y Exportación Centralizada.
  - Generada la versión HTML premium (`MANUAL_USUARIO.html`) con diseño Dark Mode, fuentes modernas, capturas de pantalla integradas y diseño responsive para distribución al equipo.
- **Capturas de Pantalla Reales**: Se integraron imágenes reales de la aplicación en `public/manual-assets/` para enriquecer el Manual de Usuario con evidencia visual fidedigna de la interfaz actual.

---

## 🚀 Próximos pasos
1. **Despliegue a Vercel:** Publicar la app en la nube con costo CERO usando `vercel deploy` para que todos en la iglesia accedan desde su celular con una URL real.
2. **PWA:** Hacer una Web App Progresiva con un `manifest.json` para que iOS / Android ofrezca "Instalar en Escritorio" de forma nativa.
3. **Notificaciones Push**: Implementar alertas cuando un bosquejo pase de "Borrador" a "Aprobado".
4. **Roles de Músicos**: Profundizar en la gestión de instrumentos específicos para que el sistema sugiera músicos basados en si falta bajo, batería o piano.

