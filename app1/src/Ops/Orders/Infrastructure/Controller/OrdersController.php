<?php

declare(strict_types=1);

namespace App\Ops\Orders\Infrastructure\Controller;

use App\Ops\Orders\Application\ConfirmOrder;
use App\Ops\Orders\Application\ShipOrder;
use App\Ops\Orders\Domain\OrderCommandsRepository;
use App\Ops\Orders\Domain\OrdersRepository;
use App\Shared\Infrastructure\Controller\PageHtml;
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
        private readonly OrderCommandsRepository $commands,
        private readonly ConfirmOrder $confirmOrder,
        private readonly ShipOrder $shipOrder,
    ) {}

    #[Route('/orders', name: 'ops_orders_list', methods: ['GET'])]
    public function list(Request $request): Response
    {
        $rows = '';

        foreach ($this->orders->all() as $order) {
            $pending = $this->commands->hasPending($order->id);

            $action = match ($order->status) {
                'created' => sprintf(
                    '<form method="post" action="/orders/%s/confirm" data-command data-order-id="%s" class="m-0">'
                    .'<button type="submit" class="cmd bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium px-3 py-1 rounded-md transition-colors">✔️ Confirmar</button></form>',
                    $order->id,
                    $order->id,
                ),
                'confirmed' => sprintf(
                    '<form method="post" action="/orders/%s/ship" data-command data-order-id="%s" class="flex items-center justify-end gap-2">'
                    .'<input name="tracking" placeholder="PLK-00000 (opcional)" class="bg-slate-950 border border-slate-700 focus:border-sky-500 focus:outline-none rounded px-2 py-1 text-xs text-white placeholder:text-slate-600 w-40">'
                    .'<button type="submit" class="cmd bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium px-3 py-1 rounded-md transition-colors">📦 Enviar</button></form>',
                    $order->id,
                    $order->id,
                ),
                default => '<span class="text-xs text-slate-500">—</span>',
            };

            $status = self::STATUS_STYLES[$order->status] ?? 'bg-slate-800 text-slate-400';
            // Indicador de comando en vuelo (docs/05): se deriva de la tabla
            // propia `ops.order_commands`, no de la cola de eventos
            $pendingBadge = $pending
                ? ' <span data-pending-for="'.htmlspecialchars($order->id, ENT_QUOTES).'" class="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300">⏳ pending</span>'
                : '';

            $rows .= sprintf(
                '<tr class="border-b border-slate-800/60 hover:bg-slate-900/60 transition-colors">'
                .'<td class="py-2.5 font-mono text-xs text-slate-400">%s</td>'
                .'<td class="py-2.5">%s</td>'
                .'<td class="py-2.5 text-right text-slate-300">%s %s</td>'
                .'<td class="py-2.5 text-right"><span data-status-for="%s" class="inline-block text-xs font-medium px-2 py-0.5 rounded-full %s">%s</span>%s</td>'
                .'<td class="py-2.5 text-right w-56">%s</td></tr>',
                $order->id,
                htmlspecialchars($order->email, ENT_QUOTES),
                $order->totalAmount,
                $order->totalCurrency,
                $order->id,
                $status,
                $order->status,
                $pendingBadge,
                $action,
            );
        }

        $errorBanner = '';
        $error = trim((string) $request->query->get('error'));

        if ($error !== '') {
            $errorBanner = sprintf(
                '<p class="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-md px-3 py-2 mb-4">⚠️ %s</p>',
                htmlspecialchars($error, ENT_QUOTES),
            );
        }

        $content = '<div class="flex items-baseline justify-between mb-6">'
            .'<h1 class="text-2xl font-semibold text-white">Back-office · pedidos</h1>'
            .'<nav class="text-sm"><a href="/products" class="text-sky-400 hover:text-sky-300">Catálogo</a></nav>'
            .'</div>'
            .'<p class="text-xs text-slate-500 mb-4">'
            .'Confirmar/Enviar ejecuta un <span class="font-mono">comando síncrono</span> contra app2 '
            .'(dueña del estado): el botón queda bloqueado mientras la petición está en vuelo y '
            .'suelta el bloqueo cuando la proyección local refleja el cambio.</p>'
            .$errorBanner
            .'<table class="w-full text-left text-sm">'
            .'<thead class="text-xs uppercase text-slate-500 border-b border-slate-800"><tr>'
            .'<th class="py-2">Pedido</th><th class="py-2">Email</th>'
            .'<th class="py-2 text-right">Total</th><th class="py-2 text-right">Estado</th><th class="py-2 text-right">Acción</th>'
            .'</tr></thead>'
            ."<tbody>{$rows}</tbody></table>"
            .'<script>'.self::pollingScript().'</script>';

        return new Response(PageHtml::render('Back-office · pedidos', $content));
    }

    #[Route('/orders/{id}/confirm', name: 'ops_orders_confirm', methods: ['POST'])]
    public function confirm(string $id): Response
    {
        try {
            ($this->confirmOrder)($id);
        } catch (\Throwable $error) {
            return new RedirectResponse('/orders?error='.urlencode($error->getMessage()), 303);
        }

        return new Response('', 204);
    }

    #[Route('/orders/{id}/ship', name: 'ops_orders_ship', methods: ['POST'])]
    public function ship(Request $request, string $id): Response
    {
        $tracking = trim((string) $request->request->get('tracking'));

        try {
            ($this->shipOrder)($id, $tracking === '' ? null : $tracking);
        } catch (\Throwable $error) {
            return new RedirectResponse('/orders?error='.urlencode($error->getMessage()), 303);
        }

        return new Response('', 204);
    }

    /** Estado de la proyección de un pedido: el JSON del polling tras el comando */
    #[Route('/orders/{id}.json', name: 'ops_orders_show_json', methods: ['GET'])]
    public function showJson(string $id): Response
    {
        $order = $this->orders->find($id);

        if ($order === null) {
            return new Response(
                (string) json_encode(['error' => 'Order not found']),
                404,
                ['Content-Type' => 'application/json'],
            );
        }

        return new Response(
            (string) json_encode([
                'id' => $order->id,
                'status' => $order->status,
                'statusChangedAt' => $order->statusChangedAt?->format(DATE_ATOM),
                'pending' => $this->commands->hasPending($order->id),
            ]),
            200,
            ['Content-Type' => 'application/json'],
        );
    }

    /**
     * Intercepta el submit: botón disabled en vuelo (evita el doble clic) y
     * polling contra el JSON del back-office hasta que la proyección refleje
     * el comando o agote el timeout (docs/09). Sin JS: los formularios
     * siguen funcionando con el redirect clásico.
     */
    private static function pollingScript(): string
    {
        $js = <<<'JS'
document.querySelectorAll('form[data-command]').forEach((form) => {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const button = form.querySelector('button');
    const orderId = form.dataset.orderId;
    const label = button.textContent;
    button.disabled = true;
    button.textContent = '⏳ enviando…';

    const fail = (message) => { button.textContent = label; button.disabled = false; window.location.href = '/orders?error=' + encodeURIComponent(message); };
    const done = (message) => { window.location.href = '/orders' + (message ? '?error=' + encodeURIComponent(message) : ''); };

    let response;
    try {
      response = await fetch(form.action, { method: 'POST', body: new FormData(form) });
    } catch {
      fail('No se pudo contactar con app2'); return;
    }

    if (!response.ok) {
      let message = 'app2 rechazó el comando (HTTP ' + response.status + ')';
      try {
        const data = await response.json();
        if (data.error) message = data.error;
      } catch {}
      fail(message); return;
    }
    // La llamada desde PHP con excepción de dominio redirige a /orders?error=… (banner)
    if (response.redirected && response.url.includes('error=')) {
      window.location.href = response.url; return;
    }

    button.textContent = '⏳ actualizando…';
    const badge = document.querySelector('[data-status-for="' + orderId + '"]');
    const pending = document.querySelector('[data-pending-for="' + orderId + '"]');
    if (badge) { badge.textContent = '⏳ pending'; badge.className = 'inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300'; }
    if (pending) pending.remove();

    const deadline = Date.now() + 15000;

    const tick = async () => {
      let data = null;
      try {
        const poll = await fetch('/orders/' + orderId + '.json');
        if (poll.ok) data = await poll.json();
      } catch {}

      if (data && !data.pending) { done(); return; }
      if (Date.now() > deadline) {
        fail('La proyección sigue desfasada (timeout): app2 aceptó el comando pero el evento aún no llega');
        return;
      }
      setTimeout(tick, 1500);
    };

    setTimeout(tick, 500);
  });
});
JS;

        return $js;
    }
}
