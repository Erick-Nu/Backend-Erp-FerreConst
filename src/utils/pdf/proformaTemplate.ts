import { PDFDocumentWithTables } from 'pdfkit-table';

import type { ProformaPdfFontConfig, ProformaPdfInput } from './proformaTypes.js';

type PdfDocWithTables = InstanceType<typeof PDFDocumentWithTables>;

type DetailTableLayout = {
  tableX: number;
  tableWidth: number;
  headerHeight: number;
  columnSpacing: number;
  numberWidth: number;
  descriptionWidth: number;
  priceWidth: number;
  quantityWidth: number;
  totalWidth: number;
  descriptionX: number;
  priceX: number;
  quantityX: number;
  totalX: number;
};

type DetailRow = {
  numero: string;
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
  total: string;
};

type ProformaStatusBadgeColors = {
  background: string;
  text: string;
  border: string;
};

const COLOR_BRAND_DARK = '#233746';
const COLOR_DARK = '#1E2F3F';
const COLOR_TEXT = '#242424';
const COLOR_MUTED = '#66717C';
const COLOR_LIGHT_ALT = '#F4F6F8';
const COLOR_STROKE = '#D7DCE1';
const COLOR_WHITE = '#FFFFFF';
const COLOR_PAGE = '#FFFFFF';

const PAGE_MARGIN_X = 34;
const PAGE_TOP_Y = 34;
const PAGE_BOTTOM_SAFE = 74;
const TABLE_FIRST_PAGE_Y = 260;
const TABLE_NEXT_PAGE_Y = 72;
const FOOTER_NEW_PAGE_Y = 86;

const CURRENCY_FORMATTER = new Intl.NumberFormat('es-EC', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const DATE_FORMATTER = new Intl.DateTimeFormat('es-EC', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function formatCurrency(value: number): string {
  return `$${CURRENCY_FORMATTER.format(value)}`;
}

function formatDate(value: Date): string {
  return DATE_FORMATTER.format(value);
}

function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function getProformaStatusLabel(status: ProformaPdfInput['estado']): string {
  if (status === 'pagada') {
    return 'PAGADA';
  }

  if (status === 'anulada') {
    return 'ANULADA';
  }

  return 'EMITIDA';
}

function getProformaStatusColors(status: ProformaPdfInput['estado']): ProformaStatusBadgeColors {
  if (status === 'pagada') {
    return {
      background: '#E7F5EC',
      text: '#1D6B45',
      border: '#B8DDC8',
    };
  }

  if (status === 'anulada') {
    return {
      background: '#FCE9E9',
      text: '#A23A3A',
      border: '#F2C4C4',
    };
  }

  return {
    background: '#E8EEF3',
    text: '#233746',
    border: '#C7D1DA',
  };
}

function drawProformaStatusBadge(
  document: PdfDocWithTables,
  data: ProformaPdfInput,
  fonts: ProformaPdfFontConfig,
  invoiceX: number,
  invoiceWidth: number,
  topY: number,
): void {
  const label = getProformaStatusLabel(data.estado);
  const colors = getProformaStatusColors(data.estado);
  const fontSize = 7.4;
  const paddingX = 10;
  const paddingY = 4;
  const badgeY = topY + 86;

  applyFont(document, fonts.bold);
  document.fontSize(fontSize);

  const textWidth = document.widthOfString(label);
  const badgeWidth = textWidth + (paddingX * 2);
  const badgeHeight = fontSize + (paddingY * 2);
  const badgeX = invoiceX + invoiceWidth - badgeWidth;

  document
    .roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 9)
    .fillColor(colors.background)
    .fill();

  document
    .roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 9)
    .lineWidth(0.6)
    .strokeColor(colors.border)
    .stroke();

  applyFont(document, fonts.bold);
  document
    .fillColor(colors.text)
    .fontSize(fontSize)
    .text(label, badgeX, badgeY + paddingY - 0.5, {
      width: badgeWidth,
      align: 'center',
      lineBreak: false,
    });
}

function applyFont(document: PdfDocWithTables, fontPathOrName: string): void {
  document.font(fontPathOrName);
}

function getContentBottomY(document: PdfDocWithTables): number {
  return document.page.height - PAGE_BOTTOM_SAFE;
}

function addPageAndResetContent(document: PdfDocWithTables): number {
  document.addPage();
  return TABLE_NEXT_PAGE_Y;
}

function getDetailTableLayout(document: PdfDocWithTables): DetailTableLayout {
  const tableX = PAGE_MARGIN_X;
  const tableWidth = document.page.width - tableX * 2;
  const headerHeight = 30;
  const columnSpacing = 0;

  const numberWidth = 42;
  const priceWidth = 74;
  const quantityWidth = 62;
  const totalWidth = 78;
  const descriptionWidth = tableWidth - numberWidth - priceWidth - quantityWidth - totalWidth;

  const descriptionX = tableX + numberWidth;
  const priceX = descriptionX + descriptionWidth;
  const quantityX = priceX + priceWidth;
  const totalX = quantityX + quantityWidth;

  return {
    tableX,
    tableWidth,
    headerHeight,
    columnSpacing,
    numberWidth,
    descriptionWidth,
    priceWidth,
    quantityWidth,
    totalWidth,
    descriptionX,
    priceX,
    quantityX,
    totalX,
  };
}

function drawPageDecoration(document: PdfDocWithTables): void {
  const pageWidth = document.page.width;
  const pageHeight = document.page.height;

  document.rect(0, 0, pageWidth, pageHeight).fillColor(COLOR_PAGE).fill();
}

function drawHeader(
  document: PdfDocWithTables,
  data: ProformaPdfInput,
  fonts: ProformaPdfFontConfig,
): number {
  const margin = PAGE_MARGIN_X;
  const topY = PAGE_TOP_Y;
  const pageWidth = document.page.width;

  const headerX = 24;
  const headerY = 24;
  const headerWidth = pageWidth - 48;
  const headerHeight = 104;
  const panelGap = 10;
  const invoicePanelWidth = 222;
  const invoicePanelX = headerX + headerWidth - invoicePanelWidth;

  const fitText = (
    source: string,
    maxWidth: number,
    initialSize: number,
    minSize: number,
  ): { text: string; fontSize: number } => {
    let fontSize = initialSize;

    applyFont(document, fonts.bold);
    document.fontSize(fontSize);

    while (fontSize > minSize && document.widthOfString(source) > maxWidth) {
      fontSize -= 0.5;
      document.fontSize(fontSize);
    }

    if (document.widthOfString(source) <= maxWidth) {
      return { text: source, fontSize };
    }

    const ellipsis = '...';
    let trimmed = source;

    while (
      trimmed.length > 1 &&
      document.widthOfString(`${trimmed}${ellipsis}`) > maxWidth
    ) {
      trimmed = trimmed.slice(0, -1);
    }

    return {
      text: `${trimmed.trimEnd()}${ellipsis}`,
      fontSize,
    };
  };

  // Panel de identidad.
  document
    .roundedRect(headerX, headerY, invoicePanelX - panelGap - headerX, headerHeight, 4)
    .fillColor(COLOR_DARK)
    .fill();

  // Panel independiente del documento.
  document
    .roundedRect(invoicePanelX, headerY, invoicePanelWidth, headerHeight, 4)
    .fillColor(COLOR_WHITE)
    .fill()
    .roundedRect(invoicePanelX, headerY, invoicePanelWidth, headerHeight, 4)
    .lineWidth(0.8)
    .strokeColor(COLOR_STROKE)
    .stroke();

  const invoiceWidth = invoicePanelWidth - 28;
  const invoiceX = invoicePanelX + 14;

  const companyX = headerX + 14;
  const companyMaxWidth = invoicePanelX - panelGap - companyX - 14;

  const fittedCompany = fitText(
    data.empresa.razonSocial,
    companyMaxWidth,
    20,
    13,
  );

  // Nombre de la empresa, sin logo
  applyFont(document, fonts.bold);
  document
    .fillColor(COLOR_WHITE)
    .fontSize(fittedCompany.fontSize)
    .text(fittedCompany.text, companyX, topY + 5, {
      width: companyMaxWidth,
      height: fittedCompany.fontSize + 6,
      lineBreak: false,
    });

  // Subtitulo institucional
  applyFont(document, fonts.regular);
  document
    .fillColor('#C7D1DA')
    .fontSize(7.3)
    .text('FERRETERIA Y SUMINISTROS', companyX, topY + 35, {
      width: companyMaxWidth,
      characterSpacing: 1.2,
      lineBreak: false,
    });

  // Línea divisoria de la empresa
  document
    .moveTo(companyX, topY + 52)
    .lineTo(Math.min(companyX + companyMaxWidth, invoiceX - 22), topY + 52)
    .lineWidth(0.7)
    .strokeColor('#4C6173')
    .stroke();

  // Datos de la empresa
  applyFont(document, fonts.regular);
  document
    .fillColor('#E8EEF3')
    .fontSize(7.1)
    .text(`RUC: ${data.empresa.ruc}`, companyX, topY + 63, {
      width: companyMaxWidth,
      ellipsis: true,
      lineBreak: false,
    })
    .fillColor('#C7D1DA')
    .text(data.empresa.correo ?? '-', companyX, topY + 77, {
      width: companyMaxWidth,
      ellipsis: true,
      lineBreak: false,
    });

  // Título PROFORMA
  const fittedTitle = fitText('PROFORMA', invoiceWidth, 27, 21);

  applyFont(document, fonts.bold);
  document
    .fillColor(COLOR_DARK)
    .fontSize(fittedTitle.fontSize)
    .text(fittedTitle.text, invoiceX, topY + 4, {
      width: invoiceWidth,
      align: 'right',
      characterSpacing: 1.2,
      lineBreak: false,
    });

  // Línea bajo el título
  document
    .moveTo(invoiceX + 42, topY + 41)
    .lineTo(invoiceX + invoiceWidth, topY + 41)
    .lineWidth(0.8)
    .strokeColor(COLOR_STROKE)
    .stroke();

  // El identificador y la fecha bastan: el titulo ya aporta el contexto.
  applyFont(document, fonts.bold);
  document
    .fillColor(COLOR_DARK)
    .fontSize(10.2)
    .text(data.identificador, invoiceX, topY + 53, {
      width: invoiceWidth,
      align: 'right',
      ellipsis: true,
      lineBreak: false,
    });

  applyFont(document, fonts.regular);
  document
    .fillColor(COLOR_BRAND_DARK)
    .fontSize(8.2)
    .text(formatDate(data.fechaEmision), invoiceX, topY + 72, {
      width: invoiceWidth,
      align: 'right',
      lineBreak: false,
    });

  drawProformaStatusBadge(document, data, fonts, invoiceX, invoiceWidth, topY);

  // Bloque inferior: cliente y resumen
  const infoY = 150;
  const leftX = margin;
  const rightX = pageWidth - 252;

  // Título cliente
  applyFont(document, fonts.bold);
  document
    .fillColor(COLOR_BRAND_DARK)
    .fontSize(8.2)
    .text('CLIENTE', leftX, infoY, {
      width: 180,
      lineBreak: false,
    });

  document
    .moveTo(leftX, infoY + 15)
    .lineTo(leftX + 250, infoY + 15)
    .lineWidth(0.6)
    .strokeColor(COLOR_STROKE)
    .stroke();

  // Nombre del cliente
  applyFont(document, fonts.bold);
  document
    .fillColor(COLOR_DARK)
    .fontSize(13.2)
    .text(data.cliente.nombre, leftX, infoY + 24, {
      width: 250,
      ellipsis: true,
      lineBreak: false,
    });

  // Datos del cliente
  applyFont(document, fonts.regular);
  document
    .fillColor(COLOR_TEXT)
    .fontSize(7.4)
    .text(`Identificación: ${data.cliente.identificacion ?? '-'}`, leftX, infoY + 48, {
      width: 250,
      ellipsis: true,
      lineBreak: false,
    })
    .text(`Teléfono: ${data.cliente.telefono ?? '-'}`, leftX, infoY + 61, {
      width: 250,
      ellipsis: true,
      lineBreak: false,
    })
    .text(`Correo: ${data.cliente.correo ?? '-'}`, leftX, infoY + 74, {
      width: 250,
      ellipsis: true,
      lineBreak: false,
    })
    .text(`Dirección: ${data.cliente.direccion ?? '-'}`, leftX, infoY + 87, {
      width: 250,
      ellipsis: true,
      lineBreak: false,
    });

  // Título resumen
  applyFont(document, fonts.bold);
  document
    .fillColor(COLOR_BRAND_DARK)
    .fontSize(8.2)
    .text('RESUMEN', rightX, infoY, {
      width: 205,
      align: 'left',
      lineBreak: false,
    });

  document
    .moveTo(rightX, infoY + 15)
    .lineTo(pageWidth - margin, infoY + 15)
    .lineWidth(0.6)
    .strokeColor(COLOR_STROKE)
    .stroke();

  // Datos resumen
  applyFont(document, fonts.regular);
  document
    .fillColor(COLOR_TEXT)
    .fontSize(7.4)
    .text(`Fecha de emisión: ${formatDate(data.fechaEmision)}`, rightX, infoY + 29, {
      width: 205,
      ellipsis: true,
      lineBreak: false,
    })
    .text(`Subtotal: ${formatCurrency(data.totales.subtotal)}`, rightX, infoY + 42, {
      width: 205,
      ellipsis: true,
      lineBreak: false,
    });

  // Total destacado
  applyFont(document, fonts.bold);
  document
    .fillColor(COLOR_DARK)
    .fontSize(8.8)
    .text(`Total: ${formatCurrency(data.totales.total)}`, rightX, infoY + 61, {
      width: 205,
      ellipsis: true,
      lineBreak: false,
    });

  return TABLE_FIRST_PAGE_Y;
}

function drawTableHeader(
  document: PdfDocWithTables,
  fonts: ProformaPdfFontConfig,
  y: number,
): number {
  const {
    tableX,
    tableWidth,
    headerHeight,
    numberWidth,
    descriptionWidth,
    priceWidth,
    quantityWidth,
    totalWidth,
    descriptionX,
    priceX,
    quantityX,
    totalX,
  } = getDetailTableLayout(document);

  document
    .roundedRect(tableX, y, tableWidth, headerHeight, 3)
    .fillColor(COLOR_BRAND_DARK)
    .fill();

  applyFont(document, fonts.bold);
  document
    .fillColor(COLOR_WHITE)
    .fontSize(7.2)
    .text('NO.', tableX, y + 11, {
      width: numberWidth,
      align: 'center',
      lineBreak: false,
    })
    .text('DESCRIPCIÓN', descriptionX + 10, y + 11, {
      width: descriptionWidth - 20,
      lineBreak: false,
    })
    .text('PRECIO', priceX, y + 11, {
      width: priceWidth,
      align: 'center',
      lineBreak: false,
    })
    .text('CANT.', quantityX, y + 11, {
      width: quantityWidth,
      align: 'center',
      lineBreak: false,
    })
    .text('TOTAL', totalX, y + 11, {
      width: totalWidth,
      align: 'center',
      lineBreak: false,
    });

  return y + headerHeight;
}

function getDetailRowHeight(
  document: PdfDocWithTables,
  fonts: ProformaPdfFontConfig,
  row: DetailRow,
): number {
  const { descriptionWidth } = getDetailTableLayout(document);

  applyFont(document, fonts.regular);
  document.fontSize(7.3);

  const descriptionHeight = document.heightOfString(row.descripcion, {
    width: descriptionWidth - 20,
    lineGap: 1.2,
  });

  return Math.max(38, Math.ceil(descriptionHeight + 17));
}

function drawDetailRow(
  document: PdfDocWithTables,
  fonts: ProformaPdfFontConfig,
  row: DetailRow,
  rowIndex: number,
  y: number,
  rowHeight: number,
): void {
  const {
    tableX,
    tableWidth,
    numberWidth,
    descriptionWidth,
    priceWidth,
    quantityWidth,
    totalWidth,
    descriptionX,
    priceX,
    quantityX,
    totalX,
  } = getDetailTableLayout(document);

  if (rowIndex % 2 !== 0) {
    document
      .rect(tableX, y, tableWidth, rowHeight)
      .fillColor(COLOR_LIGHT_ALT)
      .fill();
  }

  document
    .moveTo(tableX, y + rowHeight)
    .lineTo(tableX + tableWidth, y + rowHeight)
    .lineWidth(0.5)
    .strokeColor(COLOR_STROKE)
    .stroke();

  const textY = y + 9;

  applyFont(document, fonts.regular);
  document
    .fillColor(COLOR_MUTED)
    .fontSize(7.3)
    .text(row.numero, tableX, textY + 2, {
      width: numberWidth,
      align: 'center',
      lineBreak: false,
    });

  document
    .fillColor(COLOR_TEXT)
    .fontSize(7.3)
    .text(row.descripcion, descriptionX + 10, textY, {
      width: descriptionWidth - 20,
      height: rowHeight - 14,
      lineGap: 1.2,
      ellipsis: true,
    })
    .text(row.precioUnitario, priceX, textY + 2, {
      width: priceWidth,
      align: 'center',
      lineBreak: false,
    })
    .text(row.cantidad, quantityX, textY + 2, {
      width: quantityWidth,
      align: 'center',
      lineBreak: false,
    })
    .text(row.total, totalX, textY + 2, {
      width: totalWidth,
      align: 'center',
      lineBreak: false,
    });
}

async function drawDetailTable(
  document: PdfDocWithTables,
  data: ProformaPdfInput,
  fonts: ProformaPdfFontConfig,
  startY: number,
): Promise<void> {
  const tableData: DetailRow[] = data.detalle.map((item, index) => ({
    numero: String(index + 1).padStart(2, '0'),
    descripcion: `${item.descripcion}\nCódigo: ${item.codigo ?? 'N/A'}`,
    cantidad: formatQuantity(item.cantidad),
    precioUnitario: formatCurrency(item.precioUnitario),
    total: formatCurrency(item.precioTotal),
  }));

  let cursorY = drawTableHeader(document, fonts, startY);

  if (tableData.length === 0) {
    const emptyHeight = 42;

    document
      .moveTo(PAGE_MARGIN_X, cursorY + emptyHeight)
      .lineTo(document.page.width - PAGE_MARGIN_X, cursorY + emptyHeight)
      .lineWidth(0.5)
      .strokeColor(COLOR_STROKE)
      .stroke();

    applyFont(document, fonts.regular);
    document
      .fillColor(COLOR_MUTED)
      .fontSize(7.6)
      .text('No existen productos o servicios registrados.', PAGE_MARGIN_X, cursorY + 15, {
        width: document.page.width - PAGE_MARGIN_X * 2,
        align: 'center',
        lineBreak: false,
      });

    document.y = cursorY + emptyHeight;
    return;
  }

  tableData.forEach((row, rowIndex) => {
    const rowHeight = getDetailRowHeight(document, fonts, row);
    const contentBottomY = getContentBottomY(document);

    if (cursorY + rowHeight > contentBottomY) {
      cursorY = addPageAndResetContent(document);
      cursorY = drawTableHeader(document, fonts, cursorY);
    }

    drawDetailRow(document, fonts, row, rowIndex, cursorY, rowHeight);
    cursorY += rowHeight;
  });

  document.y = cursorY;
}

function drawFooter(
  document: PdfDocWithTables,
  data: ProformaPdfInput,
  fonts: ProformaPdfFontConfig,
  startY: number,
): void {
  const originalBottomMargin = document.page.margins.bottom;
  document.page.margins.bottom = 24;

  const margin = PAGE_MARGIN_X;
  const pageWidth = document.page.width;
  const pageHeight = document.page.height;

  const footerY = startY;
  const totalsWidth = 150;
  const totalsX = pageWidth - margin - totalsWidth;
  const leftWidth = totalsX - margin - 26;

  document
    .moveTo(margin, footerY)
    .lineTo(pageWidth - margin, footerY)
    .lineWidth(0.7)
    .strokeColor(COLOR_STROKE)
    .stroke();

  applyFont(document, fonts.bold);
  document
    .fillColor(COLOR_DARK)
    .fontSize(9)
    .text('Método de pago', margin, footerY + 16, {
      width: leftWidth,
      lineBreak: false,
    });

  applyFont(document, fonts.regular);
  document
    .fillColor(COLOR_TEXT)
    .fontSize(7.3)
    .text(data.metodoPago || '-', margin, footerY + 34, {
      width: leftWidth,
      ellipsis: true,
      lineBreak: false,
    });

  applyFont(document, fonts.bold);
  document
    .fillColor(COLOR_DARK)
    .fontSize(7.6)
    .text('Términos', margin, footerY + 61, {
      width: leftWidth,
      lineBreak: false,
    });

  const thanksMessage =
    data.branding?.termsMessage ??
    'Gracias por su preferencia. Esta proforma tiene validez de 15 días.';

  applyFont(document, fonts.regular);
  document
    .fillColor(COLOR_TEXT)
    .fontSize(7.1)
    .text(thanksMessage, margin, footerY + 75, {
      width: leftWidth,
      height: 34,
      align: 'left',
      ellipsis: true,
    });

  const labelX = totalsX;
  const valueX = totalsX + 76;
  const valueWidth = totalsWidth - 76;

  applyFont(document, fonts.regular);
  document
    .fillColor(COLOR_TEXT)
    .fontSize(7.4)
    .text('SUB TOTAL', labelX, footerY + 15, {
      width: 72,
      lineBreak: false,
    })
    .text(formatCurrency(data.totales.subtotal), valueX, footerY + 15, {
      width: valueWidth,
      align: 'right',
      lineBreak: false,
    })
    .text('DESCUENTO', labelX, footerY + 34, {
      width: 72,
      lineBreak: false,
    })
    .text(`-${formatCurrency(data.totales.descuento)}`, valueX, footerY + 34, {
      width: valueWidth,
      align: 'right',
      lineBreak: false,
    });

  document
    .roundedRect(totalsX, footerY + 60, totalsWidth, 34, 3)
    .fillColor(COLOR_BRAND_DARK)
    .fill();

  applyFont(document, fonts.bold);
  document
    .fillColor(COLOR_WHITE)
    .fontSize(8.4)
    .text('TOTAL', totalsX + 10, footerY + 72, {
      width: 52,
      lineBreak: false,
    })
    .text(formatCurrency(data.totales.total), totalsX + 66, footerY + 72, {
      width: totalsWidth - 76,
      align: 'right',
      lineBreak: false,
    });

  document
    .rect(24, pageHeight - 44, pageWidth - 48, 20)
    .fillColor(COLOR_DARK)
    .fill();

  applyFont(document, fonts.bold);
  document
    .fillColor(COLOR_WHITE)
    .fontSize(8)
    .text('GRACIAS POR SU PREFERENCIA', margin, pageHeight - 38, {
      width: 240,
      lineBreak: false,
    });

  document.page.margins.bottom = originalBottomMargin;
}

async function renderProformaTemplate(
  document: PdfDocWithTables,
  data: ProformaPdfInput,
  fonts: ProformaPdfFontConfig,
): Promise<void> {
  const drawDecoratedPage = (): void => {
    drawPageDecoration(document);
    document.page.margins.top = PAGE_TOP_Y;
    document.page.margins.left = PAGE_MARGIN_X;
    document.page.margins.right = PAGE_MARGIN_X;
    document.page.margins.bottom = PAGE_BOTTOM_SAFE;
  };

  document.on('pageAdded', drawDecoratedPage);

  drawDecoratedPage();

  const tableStartY = drawHeader(document, data, fonts);

  await drawDetailTable(document, data, fonts, tableStartY);

  const footerHeight = 132;
  const footerGap = 18;
  const preferredFooterY = document.y + footerGap;

  if (preferredFooterY + footerHeight > getContentBottomY(document)) {
    document.addPage();
    drawFooter(document, data, fonts, FOOTER_NEW_PAGE_Y);
  } else {
    drawFooter(document, data, fonts, preferredFooterY);
  }

  document.off('pageAdded', drawDecoratedPage);
}

export { renderProformaTemplate };
