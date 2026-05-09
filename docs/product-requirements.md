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

## 5. Reglas de Negocio Críticas (Business Rules - ANTI-COLISIONES)
Todo flujo de agendamiento o modificación DEBE respetar las siguientes reglas matemáticas antes de guardar una cita en `localStorage`:
* **BR-1 (Prevención de Acaparamiento - Límite Diario):** Un paciente físico (identificado por su cédula, ya sea titular o familiar) NO puede tener más de una (1) cita en la misma `especialidad` durante el mismo `día`. (La validación debe comparar fechas en formato ISO `YYYY-MM-DD`, NUNCA en texto humano).
* **Momento de Validación (Trigger de Identidad):** Esta regla NO debe ejecutarse al seleccionar el horario (Paso 2). Debe dispararse únicamente cuando la identidad del paciente final sea conocida:
    1. **Flujo Invitado/Proxy:** En el Paso 3, al hacer clic en "Siguiente" tras llenar el formulario.
    2. **Flujo Titular (Para sí mismo):** En el Paso 4, al hacer clic en "Confirmar Cita".
* **Acción ante Fallo:** Si la validación falla, se debe interrumpir la ejecución (`return`), mostrar el modal de alerta y mantener al usuario en la pantalla actual para que pueda corregir los datos o elegir otro día.
* **BR-2 (Colisión Exacta):** Un paciente no puede tener dos citas a la misma hora exacta en la misma fecha.
* **BR-3 (Buffer de Traslado):** Debe existir un espacio mínimo de 30 minutos libres antes y después de cada cita del paciente (sumado a la duración de la cita previa) para permitir el traslado dentro del centro médico.


