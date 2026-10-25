export type OrderItemPrimitives = { productId: string; quantity: number; unitPrice: number };

export class OrderItem {
  constructor(
    public readonly id: string,
    public readonly productId: string,
    public readonly quantity: number,
    public readonly unitPrice: number,
  ) {}
}
