import { v4 } from "uuid";

import { AggregateRoot } from "../../../shared/domain/AggregateRoot";
import { OrderCreatedDomainEvent } from "./OrderCreatedDomainEvent";
import { OrderItem, type OrderItemPrimitives } from "./OrderItem";

export type OrderStatus = "created" | "confirmed" | "shipped";

export type OrderPrimitives = {
  id: string;
  email: string;
  totalAmount: number;
  totalCurrency: string;
  status: OrderStatus;
  createdAt: Date;
  items: OrderItemPrimitives[];
};

type OrderCreationItems = Omit<OrderItemPrimitives, "unitPrice"> & { unitPrice: number };

export class Order extends AggregateRoot {
  private constructor(
    public readonly id: string,
    public readonly email: string,
    private readonly items: OrderItem[],
    public readonly totalAmount: number,
    public readonly totalCurrency: string,
    public readonly status: OrderStatus,
    public readonly createdAt: Date,
  ) {
    super();
  }

  /** Crea el pedido y registra `order_created` con el payload de docs/04 */
  static create(email: string, itemsInput: OrderCreationItems[], currency: string): Order {
    const items = itemsInput.map(
      (item) => new OrderItem(v4(), item.productId, item.quantity, item.unitPrice),
    );
    const totalAmount = itemsInput.reduce(
      (total, item) => total + item.unitPrice * item.quantity,
      0,
    );

    const order = new Order(
      v4(),
      email,
      items,
      Number(totalAmount.toFixed(2)),
      currency,
      "created",
      new Date(),
    );
    order.record(
      new OrderCreatedDomainEvent(
        order.id,
        email,
        order.totalAmount,
        currency,
        items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      ),
    );

    return order;
  }

  /** Reconstrucción desde las filas de `comercio` (sin eventos) */
  static fromPrimitives(primitives: OrderPrimitives): Order {
    return new Order(
      primitives.id,
      primitives.email,
      primitives.items.map(
        (item) => new OrderItem(v4(), item.productId, item.quantity, item.unitPrice),
      ),
      primitives.totalAmount,
      primitives.totalCurrency,
      primitives.status,
      primitives.createdAt,
    );
  }

  getItems(): OrderItem[] {
    return this.items;
  }

  toPrimitives(): OrderPrimitives {
    return {
      id: this.id,
      email: this.email,
      totalAmount: this.totalAmount,
      totalCurrency: this.totalCurrency,
      status: this.status,
      createdAt: this.createdAt,
      items: this.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
    };
  }
}
