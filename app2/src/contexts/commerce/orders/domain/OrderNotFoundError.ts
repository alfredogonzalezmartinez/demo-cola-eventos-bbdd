import type { CodelyErrorPrimitives } from "../../../shared/domain/CodelyError";
import { CodelyError } from "../../../shared/domain/CodelyError";

/** app2 no encuentra el pedido (404 en el comando síncrono de app1) */
export class OrderNotFoundError extends CodelyError {
  constructor(orderId: string) {
    super({ orderId });
  }

  override get message(): string {
    return `Order not found: ${this.params.orderId as string}`;
  }

  toResponse(): { error: string } {
    return { error: "Order not found" };
  }

  toPrimitives(): CodelyErrorPrimitives {
    return { type: "order_not_found", params: this.params };
  }
}
