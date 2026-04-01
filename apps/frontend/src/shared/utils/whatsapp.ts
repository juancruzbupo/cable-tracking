export function generarMensajeDeuda(data: {
  nombre: string;
  deudaCable?: number | null;
  deudaInternet?: number | null;
  cantidadDeuda: number;
}): string {
  const nombre = data.nombre.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const servicios: string[] = [];
  if (data.deudaCable && data.deudaCable > 0) servicios.push(`Cable: ${data.deudaCable} mes${data.deudaCable > 1 ? 'es' : ''}`);
  if (data.deudaInternet && data.deudaInternet > 0) servicios.push(`Internet: ${data.deudaInternet} mes${data.deudaInternet > 1 ? 'es' : ''}`);
  const detalle = servicios.length > 0 ? `\n${servicios.join('\n')}` : '';
  return `Hola ${nombre}, le comunicamos que registra ${data.cantidadDeuda} mes${data.cantidadDeuda > 1 ? 'es' : ''} pendiente${data.cantidadDeuda > 1 ? 's' : ''} de pago.${detalle}\n\nPor favor, regularice su situacion para evitar la interrupcion del servicio.\n\nGracias.`;
}

export function generarLinkWhatsApp(telefono: string, mensaje: string): string {
  const limpio = telefono.replace(/[\s\-\(\)\+]/g, '');
  const final = limpio.startsWith('549') ? limpio : limpio.startsWith('54') ? `9${limpio}` : `549${limpio}`;
  return `https://wa.me/${final}?text=${encodeURIComponent(mensaje)}`;
}

export function abrirWhatsApp(telefono: string, mensaje: string): void {
  window.open(generarLinkWhatsApp(telefono, mensaje), '_blank');
}
