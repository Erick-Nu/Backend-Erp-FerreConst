import type { SendProformaModel } from '../data/sendProformaModel.js';

function buildSendProformaWhatsappCaption(task: SendProformaModel): string {
  return `Estimado/a ${task.sendclntenombre}, compartimos su proforma ${task.sendprfmaidentificador} en formato PDF para su revision.`;
}

export { buildSendProformaWhatsappCaption };
