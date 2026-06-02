# Agents

Esta carpeta contiene procesos en segundo plano (agentes).

## Convencion

Cada agente vive en su propia carpeta y tiene su propio punto de arranque.

Estructura base por agente:

- `src/agents/<agent-name>/main.ts`

Archivos opcionales por agente (si el agente lo necesita):

- `types.ts`
- `service.ts`
- `dao.ts`

## Primer agente

- `sendProforma`

## Objetivo

Mantener agentes aislados entre si para que cada uno pueda evolucionar,
ejecutarse y desplegarse de forma independiente.
