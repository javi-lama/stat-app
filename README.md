# STAT. | Hospital Workflow Manager



![Version](https://img.shields.io/badge/version-v1.20-blue) ![Status](https://img.shields.io/badge/status-production-success) ![Tech Stack](https://img.shields.io/badge/tech-React%20%7C%20Supabase%20%7C%20Tailwind-blueviolet) ![PWA](https://img.shields.io/badge/PWA-Optimized-success) ![Localization](https://img.shields.io/badge/lang-ES_Medical-00C09E)

> **"La medicina ocurre en milisegundos. Tu software también debería hacerlo."**

**STAT.** es una aplicación de gestión hospitalaria de alto rendimiento, diseñada por y para médicos. Más que una lista de tareas, es un **EHR (Electronic Health Record) ligero y dinámico** enfocado en la ejecución clínica. Optimiza el flujo de trabajo diario de los equipos de hospitalización, reduce la carga cognitiva y erradica la pérdida de información durante los pases de guardia.

---

## 🏥 El Problema Clínico
La gestión de pacientes hospitalizados suele depender de sistemas analógicos y fragmentados (notas en papel, mensajería no segura, memoria humana). Esto genera:
* Pérdida de tareas y retrasos diagnósticos.
* Fricción y riesgo médico en la entrega de guardia.
* Imposibilidad de auditar la ejecución de indicaciones en tiempo real.

## ⚡ La Solución (v1.20)
STAT. centraliza la sala en una interfaz colaborativa de latencia cero. Está construida bajo principios **Mobile-First** y **UI Defensiva**, diseñada para operar al pie de la cama o en la estación de enfermería bajo cualquier condición de red.

### ✨ Funcionalidades Principales & Características Técnicas

#### 🚀 Colaboración de Latencia Cero (Optimistic UI)
* **Sincronización Realtime (Supabase):** Implementación de WebSockets bidireccionales para un estado global compartido.
* **Mutaciones Optimistas:** Patrón de diseño "Trust but Verify" que elimina la latencia percibida. Las interacciones (check/uncheck, creación de tareas) se reflejan instantáneamente en la UI local mientras se reconcilian de forma asíncrona en la base de datos, garantizando cero *Drift de Estado*.

#### 🔄 Gestión de Flujo de Trabajo
* **Categorización Clínica:** Clasificación visual de tareas (Laboratorio 🧪, Imágenes 🩻, Interconsulta 🩺, Procedimientos, Trámites).
* **Tipos de Trabajo Inteligente:** Distinción arquitectónica entre tareas clínicas (requieren validación en 3 pasos) y administrativas (check simple).
* **Traducción Médica Nativa:** Interfaz localizada al 100% en Español Médico Profesional, minimizando la carga cognitiva.

#### ⏳ Navegación Temporal
* **Snapshots Diarios Inmutables:** El sistema aísla y guarda el estado exacto de las tareas por día para auditorías precisas.
* **Carry-Over Inteligente:** Motor de migración de tareas de un clic para trasladar pendientes al día actual, eliminando la transcripción manual.

#### 📱 Experiencia Clínica
* **Progressive Web App (PWA):** Instalable en iOS y Android con renderizado *standalone* y soporte *Maskable Icon* para una experiencia nativa.
* **UI Liquida:** Grilla responsiva conservadora que evita la colisión visual de datos en pantallas clínicas densas.
* **Hand-off Inteligente:** Generación automatizada de reportes de guardia compactos, listos para pegar y conformes a estándares de comunicación segura.

---

## 🛠️ Arquitectura y Tech Stack

Construido para escalar en entornos hospitalarios de alta demanda:

* **Frontend:** [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) (Tipado estricto para seguridad de datos médicos).
* **State Management:** Context API + Custom Hooks para segregación lógica.
* **Build Engine:** [Vite](https://vitejs.dev/) (HMR ultrarrápido).
* **UI/UX:** [Tailwind CSS](https://tailwindcss.com/) (Sistema utilitario de diseño) + Componentes Radix/Shadcn.
* **Backend & Database:** [Supabase](https://supabase.com/) (PostgreSQL + RLS Policies + Realtime Subscriptions).
* **Deployment:** [Vercel](https://vercel.com/) (Edge Network & CI/CD pipeline).

---

## 🚀 Roadmap: El Futuro de STAT.

Nos encontramos en pleno desarrollo de la **v2.0**, transformando STAT. en un ecosistema Multi-Tenant (Multi-Servicio):

- [🏃 En Progreso] **Arquitectura Multi-Tenant (RBAC):** Aislamiento de datos a nivel de base de datos (Row Level Security) y Estado Global para soportar múltiples pabellones (Ej: Medicina Interna, Cirugía General, etc.) simultáneamente.
- [🏃 En Progreso] **Módulo EVOS & BH:** Matriz de seguimiento unificada para Balances Hídricos y Notas de Evolución diarias por paciente.
- [🏃 En Progreso] **Patient Deep Dive:** Vista longitudinal individualizada (Línea de tiempo clínica y archivos adjuntos).
- [🏃 En Progreso] **POCUS Integration:** Módulo para documentar y asociar hallazgos ecográficos *Point-of-Care* directamente a la cama del paciente.
- [🏃 En Progreso] **Clinical Intelligence:** Dashboards analíticos para Jefaturas de Servicio (Métricas de estancia y eficiencia de resolución).

---

## 💻 Entorno de Desarrollo Local

Instrucciones para desplegar el entorno clínico localmente:

1.  **Clonar el repositorio:**
    ```bash
    git clone [https://github.com/tu-usuario/stat-app.git](https://github.com/tu-usuario/stat-app.git)
    ```
2.  **Instalar dependencias:**
    ```bash
    npm install
    ```
3.  **Configurar credenciales (Environment Variables):**
    Crea un archivo `.env` en el directorio raíz:
    ```env
    VITE_SUPABASE_URL=your_supabase_project_url
    VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```
4.  **Iniciar el servidor de desarrollo:**
    ```bash
    npm run dev
    ```

---

<div align="center">
  <p>Engineered for High-Performance Medicine by <strong>Divini Technologies</strong></p>
  <p>Lima, Perú 🇵🇪 | 2026</p>
</div>