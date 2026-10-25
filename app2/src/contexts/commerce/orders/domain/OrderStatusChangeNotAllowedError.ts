import { CodelyError } from "../../../shared/domain/CodelyError";

/**
 * La máquina de estados de `comercio` no permite el cambio pedido
 * (409 en el comando síncrono de app1): estado actual distinto al
 * previo requerido. Los params rebotan en la respuesta JSON para que
 * el remitente reconstruya su excepción con el mismo rótulo.
 */
export class OrderStatusChangeNotAllowedError extends CodelyError {
  constructor(orderId: string, currentStatus: string, expectedStatus: string) {
    super({ orderId, currentStatus, expectedStatus });
  }

  override get message(): string {
    return `Order ${this.params.orderId as string} is in status ${this.params.currentStatus as string}: to advance it must be ${this.params.expectedStatus as string}`;
  }
}
