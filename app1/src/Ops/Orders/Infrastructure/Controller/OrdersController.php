<?php

declare(strict_types=1);

namespace App\Ops\Orders\Infrastructure\Controller;

use App\Ops\Orders\Application\ConfirmOrder;
use App\Ops\Orders\Application\ShipOrder;
use App\Ops\Orders\Domain\OrdersRepository;
use App\Shared\Infrastructure\Controller\PageHtml;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\Routing\Attribute\Route;

#[AsController]
final class OrdersController
{
    /** Estado → clases del badge, igual que `orders.astro` de app2 */
    private const STATUS_STYLES = [
        'created' => 'bg-amber-500/10 text-amber-300',
        'confirmed' => 'bg-emerald-500/10 text-emerald-300',
        'shipped' => 'bg-sky-500/10 text-sky-300',
    ];

    public function __construct(
        private readonly OrdersRepository $orders,
        private readonly ConfirmOrder $confirmOrder,
        private readonly ShipOrder $shipOrder,
    ) {}

    #[Route('/orders', name: 'ops_orders_list', methods: ['GET'])]
    public function list(): Response
    {
        $rows = '';

        foreach ($this->orders->all() as $order) {
            $action = match ($order->status) {
                'created' => sprintf(
                    '<form method="post" action="/orders/%s/confirm" class="m-0">'
                    .'<button type="submit" class="bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium px-3 py-1 rounded-md transition-colors">✔️ Confirmar</button></form>',
                    $order->id,
                ),
                'confirmed' => sprintf(
                    '<form method="post" action="/orders/%s/ship" class="flex items-center justify-end gap-2">'
                    .'<input name="tracking" placeholder="PLK-00000 (opcional)" class="bg-slate-950 border border-slate-700 focus:border-sky-500 focus:outline-none rounded px-2 py-1 text-xs text-white placeholder:text-slate-600 w-40">'
                    .'<button type="submit" class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium px-3 py-1 rounded-md transition-colors">📦 Enviar</button></form>',
                    $order->id,
                ),
                default => '<span class="text-xs text-slate-500">—</span>',
            };

            $status = self::STATUS_STYLES[$order->status] ?? 'bg-slate-800 text-slate-400';

            $rows .= sprintf(
                '<tr class="border-b border-slate-800/60 hover:bg-slate-900/60 transition-colors">'
                .'<td class="py-2.5 font-mono text-xs text-slate-400">%s</td>'
                .'<td class="py-2.5">%s</td>'
                .'<td class="py-2.5 text-right text-slate-300">%s %s</td>'
                .'<td class="py-2.5 text-right"><span class="inline-block text-xs font-medium px-2 py-0.5 rounded-full %s">%s</span></td>'
                .'<td class="py-2.5 text-right w-56">%s</td></tr>',
                $order->id,
                htmlspecialchars($order->email, ENT_QUOTES),
                $order->totalAmount,
                $order->totalCurrency,
                $status,
                $order->status,
                $action,
            );
        }

        $content = '<div class="flex items-baseline justify-between mb-6">'
            .'<h1 class="text-2xl font-semibold text-white">Back-office · pedidos</h1>'
            .'<nav class="text-sm"><a href="/products" class="text-sky-400 hover:text-sky-300">Products (views)</a></nav>'
            .'</div>'
            .'<p class="text-xs text-slate-500 mb-4">'
            .'Confirmar/Enviar publica <span class="font-mono">ops.order_confirmed/order_shipped</span> en la cola; '
            .'app2 actualiza el estado al consumir.</p>'
            .'<table class="w-full text-left text-sm">'
            .'<thead class="text-xs uppercase text-slate-500 border-b border-slate-800"><tr>'
            .'<th class="py-2">Pedido</th><th class="py-2">Email</th>'
            .'<th class="py-2 text-right">Total</th><th class="py-2 text-right">Estado</th><th class="py-2 text-right">Acción</th>'
            .'</tr></thead>'
            ."<tbody>{$rows}</tbody></table>";

        return new Response(PageHtml::render('Back-office · pedidos', $content));
    }

    #[Route('/orders/{id}/confirm', name: 'ops_orders_confirm', methods: ['POST'])]
    public function confirm(Request $request, string $id): Response
    {
        ($this->confirmOrder)($id);

        return new RedirectResponse('/orders', 303);
    }

    #[Route('/orders/{id}/ship', name: 'ops_orders_ship', methods: ['POST'])]
    public function ship(Request $request, string $id): Response
    {
        $tracking = trim((string) $request->request->get('tracking'));

        ($this->shipOrder)($id, $tracking === '' ? null : $tracking);

        return new RedirectResponse('/orders', 303);
    }
}
