export interface OrderStatusUpdater {
  /**
   * Cambio con compare-and-swap (remodelado, docs/05): aplica el nuevo
   * estado y registra el history en UNA transacción de `comercio`, sólo
   * si el pedido está en `expectedStatus`. Devuelve `false` si otro
   * proceso ya lo cambió — el caso de uso lo rechaza con 409.
   */
  apply(
    orderId: string,
    status: "confirmed" | "shipped",
    expectedStatus: "created" | "confirmed",
    trackingNumber?: string,
  ): Promise<boolean>;
}
