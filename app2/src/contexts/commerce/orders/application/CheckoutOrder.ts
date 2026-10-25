import type { EventBus } from "../../../shared/domain/event/EventBus";
import { Order } from "../domain/Order";
import type { OrderRepository } from "../domain/OrderRepository";
import type { ProductRepository } from "../../products/domain/ProductRepository";

/**
 * El caso de uso guarda el pedido y después publica (dos pasos, igual que la
 * referencia: el bus abre su propia transacción en `eventos`, docs/05).
 */
export class CheckoutOrder {
  constructor(
    private readonly orderRepository: OrderRepository,
    private readonly productRepository: ProductRepository,
    private readonly eventBus: EventBus,
  ) {}

  async run(email: string, items: { productId: string; quantity: number }[]): Promise<Order> {
    if (items.length === 0) {
      throw new Error("Checkout requires at least one item");
    }

    const productsById = new Map(
      (await this.productRepository.searchAll()).map((product) => [product.id, product]),
    );

    const itemsWithPrices = items.map((item) => {
      const product = productsById.get(item.productId);

      if (!product) {
        throw new Error(`Unknown product in checkout: ${item.productId}`);
      }

      return { ...item, unitPrice: product.priceAmount };
    });

    const currency = productsById.get(items[0].productId)!.priceCurrency;

    const order = Order.create(email, itemsWithPrices, currency);
    await this.orderRepository.save(order);
    await this.eventBus.publish(order.pullDomainEvents());

    return order;
  }
}
