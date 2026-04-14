# WorshipStudio Asaf - Documentación (Wiki)

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

### Fase 5: Vistas de Alta Densidad (Matriz Vocal)
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

## 🚀 Próximos pasos
1. **Despliegue a Vercel:** Publicar la app en la nube con costo CERO usando `vercel deploy` para que todos en la iglesia accedan desde su celular con una URL real.
2. **PWA:** Hacer una Web App Progresiva con un `manifest.json` para que iOS / Android ofrezca "Instalar en Escritorio" desde Chrome o Safari.
3. **Notificaciones:** Implementar alertas (push/email) cuando un bosquejo pase a revisión.
