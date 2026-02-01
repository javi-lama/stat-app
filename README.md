# STAT. | Hospital Workflow Manager

![Version](https://img.shields.io/badge/version-v1.14-blue) ![Status](https://img.shields.io/badge/status-production-success) ![Stack](https://img.shields.io/badge/tech-React%20%7C%20Supabase%20%7C%20Tailwind-blueviolet)

> **"Medicine happens fast. Your workflow should too."**

**STAT.** es una aplicación de gestión hospitalaria de alto rendimiento diseñada por y para médicos. No es solo una lista de tareas; es un **EHR (Electronic Health Record) ligero y dinámico** enfocado en optimizar el flujo de trabajo diario de los equipos de hospitalización, reduciendo la carga cognitiva y asegurando que ninguna orden médica se pierda en el cambio de turno.

---

## 🏥 El Problema
El seguimiento de pacientes hospitalizados a menudo depende de sistemas fragmentados: notas en papel, grupos de WhatsApp inseguros y memoria humana. Esto genera:
* Pérdida de tareas pendientes ("Carry-over" fallido).
* Dificultad para auditar qué se hizo en días anteriores.
* Fricción en el pase de guardia (Hand-off).

## ⚡ La Solución: STAT. v1.14
STAT. centraliza la gestión de la sala (Ward) en una interfaz en tiempo real, segura y diseñada bajo principios de **"Mobile-First"** para ser usada al pie de la cama o en la estación de enfermería.

### ✨ Funcionalidades Principales (Core Features)

#### 🔄 Gestión de Flujo en Tiempo Real
* **Sincronización Instantánea (Supabase):** Los cambios se reflejan milisegundos después en todos los dispositivos del equipo.
* **Categorización Inteligente:** Clasificación visual de tareas (Lab 🧪, Imagen 🩻, Interconsulta 🩺, Procedimiento, Administrativo).
* **Workflow Type:** Distinción clara entre tareas clínicas (verificación de 3 pasos) y administrativas (check simple).

#### ⏳ The Time Machine (Navegación Temporal)
* **Historial Diario:** Navegación fluida entre "Ayer", "Hoy" y "Mañana".
* **Snapshots Diarios:** El sistema guarda el estado exacto de las tareas al final del día para auditoría futura.
* **Smart Carry-Over:** Funcionalidad de un clic para importar tareas pendientes ("no realizadas") del día anterior al día actual, evitando la re-escritura manual.

#### 📱 Experiencia Clínica (UX/UI)
* **Diseño Responsivo:** Optimizado para iPads y Smartphones (botones de acción "always-visible" en táctil).
* **Smart Hand-off:** Generación automática de reportes de guardia compactos y legibles, listos para copiar y pegar en mensajería segura.
* **Camas Editables & Auto-Sort:** Sistema dinámico para cambiar números de cama que reordena automáticamente el dashboard.

#### 🛡️ Seguridad y Compliance
* **Guardrails de Fecha:** Alertas visuales y de confirmación para evitar crear órdenes en el día equivocado.
* **Autenticación Robusta:** Acceso seguro por usuario (RLS policies en base de datos).

---

## 🛠️ Tech Stack

Este proyecto está construido con una arquitectura moderna, escalable y mantenible:

* **Frontend:** [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) (Tipado estricto para seguridad clínica).
* **Build Tool:** [Vite](https://vitejs.dev/) (Rendimiento ultrarrápido).
* **Estilos:** [Tailwind CSS](https://tailwindcss.com/) (Sistema de diseño utilitario y consistente).
* **Backend & Database:** [Supabase](https://supabase.com/) (PostgreSQL + Realtime Subscriptions).
* **Deployment:** [Vercel](https://vercel.com/) (CI/CD automático).

---

## 🚀 Roadmap: El Futuro de STAT.

Estamos construyendo la versión **v2.0**. Estos son nuestros próximos hitos:

- [ ] **Deep Dive (Vista Individual):** Página dedicada por paciente con notas de evolución (SOAP) y timeline específico.
- [ ] **The Revolving Door:** Sistema completo de Admisión y Alta (Admit/Discharge) para gestión histórica de ocupación de camas.
- [ ] **Clinical Intelligence:** Dashboard de analíticas para Jefes de Servicio (Promedio de estancia, eficiencia de resolución de tareas).
- [ ] **Integración POCUS:** Módulo para cargar y etiquetar hallazgos ecográficos directamente en la tarea.

---

## 💻 Instalación y Desarrollo Local

Si deseas colaborar o probar el entorno de desarrollo:

1.  **Clonar el repositorio:**
    ```bash
    git clone [https://github.com/tu-usuario/stat-app.git](https://github.com/tu-usuario/stat-app.git)
    ```
2.  **Instalar dependencias:**
    ```bash
    npm install
    ```
3.  **Configurar variables de entorno:**
    Crea un archivo `.env` en la raíz con tus credenciales de Supabase:
    ```env
    VITE_SUPABASE_URL=tu_url
    VITE_SUPABASE_ANON_KEY=tu_anon_key
    ```
4.  **Correr el servidor local:**
    ```bash
    npm run dev
    ```

---

<div align="center">
  <p>Engineered for High-Performance Medicine by <strong>Divini Technologies</strong></p>
  <p>Lima, Perú 🇵🇪 | 2026</p>
</div>
