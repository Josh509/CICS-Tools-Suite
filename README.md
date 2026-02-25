# CICS Tools Suite

Suite de herramientas web para construir y validar mensajes CICS (COMMAREA / Channels) en entornos mainframe.

## Herramientas

### 🔵 CICS Trace Generator
Genera mensajes estructurados de entrada para servicios CICS a partir de un layout copiado desde una tabla (Excel, Word, etc.).

**Características:**
- Importa layout desde Excel (copiar/pegar) o archivo `.cicsform`
- Soporte para grupos OCCURS con instancias múltiples
- Parte fija / header: extracción desde traza ejemplo o ingreso manual
- Tipos COBOL: `X(n)`, `9(n)`, `9(n)V9(m)`, `FILLER`
- Dropdowns para campos con valores controlados
- Exporta traza generada como `.txt`
- Guarda y restaura el formulario completo como `.cicsform`

### 🟢 CICS Response Validator
Parsea y valida mensajes de respuesta CICS contra el layout definido.

**Características:**
- Acepta layout desde `.cicsform` del Generador directamente
- Extracción de campos por posición exacta
- Validaciones configurables: obligatorios, tipo numérico, lista de valores, longitud total
- Visualización coloreada de la traza campo a campo con hover
- Scoreboard con totales de OK / Advertencias / Errores
- Descarga reporte en `.TXT` (columnas fijas) y `.CSV` (para Excel)

## Flujo de trabajo

```
GENERADOR → Servicio CICS (Mainframe) → VALIDADOR
```

1. **Generador:** Define el layout, completa el formulario y genera la traza de envío
2. **CICS:** El mensaje viaja al mainframe y retorna una respuesta
3. **Validador:** Pega la respuesta y valida cada campo contra el mismo layout

## Tipos COBOL soportados

| Tipo | Descripción |
|------|-------------|
| `X(n)` | Alfanumérico — rellena/extrae `n` caracteres |
| `9(n)` | Numérico entero — rellena con ceros a la izquierda |
| `9(n)V9(m)` | Decimal COBOL — `n` enteros + `m` decimales (sin punto) |
| `FILLER` | Relleno automático, no editable ni validado |

## Formato del layout (tabla Excel)

Columnas esperadas (el orden y nombre exacto no importa, se detectan automáticamente):

| Campo | Largo | Tipo | Descripción | Oblig | Valores |
|-------|-------|------|-------------|-------|---------|
| RV-COD-TRX | 4 | X(04) | Código transacción | SI | 'RESV','CANC','MODI' |
| RV-NUM-RESERVA | 10 | X(010) | Número de reserva | SI | |
| RV-FEC-ENTRADA | 8 | 9(008) | Fecha entrada AAAAMMDD | SI | |

## Estructura del proyecto

```
cics-tools-suite/
├── index.html          # HTML principal (estructura + SVG sprite + modales)
├── css/
│   └── styles.css      # Todos los estilos
├── js/
│   ├── utils.js        # Funciones compartidas (formatField, parseValues, etc.)
│   ├── generator.js    # Lógica del Generador de Trazas
│   ├── validator.js    # Lógica del Validador de Respuestas
│   └── app.js          # Navegación e inicialización
└── README.md
```



## Tecnologías

- HTML5 / CSS3 / JavaScript (Vanilla, sin dependencias)
- Fuente: [IBM Plex Mono](https://fonts.google.com/specimen/IBM+Plex+Mono) (Google Fonts)
- Autocontenido: no requiere instalación ni conexión a internet para funcionar

## Autor

**Josué Legeon**  
CICS Tools Suite v2.1.0
