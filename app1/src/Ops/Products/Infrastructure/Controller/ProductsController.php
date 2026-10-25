<?php

declare(strict_types=1);

namespace App\Ops\Products\Infrastructure\Controller;

use App\Ops\Products\Domain\ProductsRepository;
use App\Shared\Infrastructure\Controller\PageHtml;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\Routing\Attribute\Route;

#[AsController]
final class ProductsController
{
    public function __construct(private readonly ProductsRepository $products) {}

    /** Panel read-only: visibiliza el contador que sube el consumidor */
    #[Route('/products', name: 'ops_products_list', methods: ['GET'])]
    public function list(): Response
    {
        $rows = '';

        foreach ($this->products->all() as $product) {
            $rows .= sprintf(
                '<tr class="border-b border-slate-800/60 hover:bg-slate-900/60 transition-colors">'
                .'<td class="py-2.5 font-mono text-xs text-slate-400">%s</td>'
                .'<td class="py-2.5">%s</td>'
                .'<td class="py-2.5 text-right text-slate-300">%s %s</td>'
                .'<td class="py-2.5 text-right"><span class="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300">%d views</span></td>'
                .'</tr>',
                $product->id,
                htmlspecialchars($product->name, ENT_QUOTES),
                $product->priceAmount,
                $product->priceCurrency,
                $product->views,
            );
        }

        $content = '<div class="flex items-baseline justify-between mb-6">'
            .'<h1 class="text-2xl font-semibold text-white">Back-office · products</h1>'
            .'<nav class="text-sm"><a href="/orders" class="text-sky-400 hover:text-sky-300">Pedidos</a></nav>'
            .'</div>'
            .'<p class="text-xs text-slate-500 mb-4">'
            .'Las views las sube el consumidor de app1 al procesar '
            .'<span class="font-mono">commerce.product_viewed</span> publicado por app2.</p>'
            .'<table class="w-full text-left text-sm">'
            .'<thead class="text-xs uppercase text-slate-500 border-b border-slate-800"><tr>'
            .'<th class="py-2">Producto</th><th class="py-2">Nombre</th>'
            .'<th class="py-2 text-right">Precio</th><th class="py-2 text-right">Views</th>'
            .'</tr></thead>'
            ."<tbody>{$rows}</tbody></table>";

        return new Response(PageHtml::render('Back-office · products', $content));
    }
}
