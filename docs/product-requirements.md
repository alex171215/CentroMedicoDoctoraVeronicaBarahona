# Requisitos del Producto (Product Requirements)

## 1. Visión General
**Producto:** Plataforma Web SPA (Single Page Application)
**Cliente:** Centro Médico Familiar Dra. Verónica Barahona
**Objetivo:** Digitalizar la interacción de los pacientes con el centro médico mediante un diseño funcional, inclusivo y cognitivamente coherente.

## 2. Restricciones Críticas de Negocio
* **Módulo de Farmacia:** Es EXCLUSIVAMENTE un catálogo de visibilidad de stock (búsqueda de medicamentos genéricos/comerciales). **NO es un e-commerce** (no hay carrito de compras ni pasarela de pagos) y **NO incluye un mapa interactivo** por restricciones de permisos.

## 3. Tipos de Usuarios
1. **Paciente Registrado (Logueado):** * Tiene acceso al dashboard "Mi Salud" (historial médico, recetas, citas).
   * Disfruta de flujos de agendamiento rápidos con autocompletado de datos.
2. **Paciente Invitado (No Logueado):** * Ingresa datos manualmente para agendar. 
   * Seguimiento mediante un "Código de Cita" alfanumérico y comprobante PDF. 
   * Utiliza el Widget del Home (Cédula + Código) para consultar, modificar o cancelar citas.

## 4. Flujos Principales (Core Flows)
* **Agendamiento (Divulgación Progresiva):** Paso 0 (Especialidad) -> Paso 1 (Médico) -> Paso 2 (Calendario/Horario) -> Paso 3 (Datos) -> Confirmación.
* **Gestión de Citas (CRUD):** Los usuarios (logueados e invitados) deben poder agendar, consultar, modificar fecha/hora y cancelar citas.
* **Consulta "Mi Salud":** Centralización de información clínica mediante un patrón Maestro-Detalle.