type Status = 'activo' | 'inactivo' | 'eliminado';

type Role = 'administrador' | 'jefe' | 'empleado';

type ProformaStatus = 'emitida' | 'pagada' | 'anulada';

type Identification = 'cedula' | 'ruc';

type SendStatus = 'pendiente' | 'procesando' | 'completado' | 'fallido';

export type { Identification, ProformaStatus, Role, SendStatus, Status };
