<?php

declare(strict_types=1);

namespace App\Ops\Products\Infrastructure\Controller;

use App\Ops\Products\Application\AddProduct;
use App\Ops\Products\Application\UpdateProduct;
use App\Ops\Products\Domain\ProductsRepository;
use App\Shared\Infrastructure\Controller\PageHtml;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Attribute\AsController;
use Symfony\Component\Routing\Attribute\Route;

#[AsController]
final class ProductsController
{
    public function __construct(
        private readonly ProductsRepository $products,
        private readonly AddProduct $addProduct,
        private readonly UpdateProduct $updateProduct,
    ) {}

    /** Fuente del catálogo: alta y edición para que app2 proyecte la tienda (docs/05) */
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
                .'<td class="py-2.5 text-right">'
                .'<form method="post" action="/products/%s" class="flex items-center justify-end gap-2">'
                .'<input name="name" value="%s" class="bg-slate-950 border border-slate-700 focus:border-sky-500 focus:outline-none rounded px-2 py-1 text-xs text-white w-40">'
                .'<input name="price" type="number" step="0.01" min="0" value="%s" class="bg-slate-950 border border-slate-700 focus:border-sky-500 focus:outline-none rounded px-2 py-1 text-xs text-white w-20 text-right">'
                .'<button type="submit" class="bg-slate-700 hover:bg-sky-600 text-white text-xs font-medium px-3 py-1 rounded-md transition-colors">💾 Guardar</button>'
                .'</form></td></tr>',
                $product->id,
                htmlspecialchars($product->name, ENT_QUOTES),
                $product->priceAmount,
                $product->priceCurrency,
                $product->views,
                $product->id,
                htmlspecialchars($product->name, ENT_QUOTES),
                $product->priceAmount,
            );
        }

        $content = '<div class="flex items-baseline justify-between mb-6">'
            .'<h1 class="text-2xl font-semibold text-white">Back-office · catálogo</h1>'
            .'<nav class="text-sm"><a href="/orders" class="text-sky-400 hover:text-sky-300">Pedidos</a></nav>'
            .'</div>'
            .'<p class="text-xs text-slate-500 mb-4">'
            .'Esta tabla es la <span class="font-mono">fuente</span> del catálogo (BD <span class="font-mono">ops</span>): '
            .'cada alta o edición publica <span class="font-mono">ops.product_*</span> y app2 actualiza su proyección al consumir. '
            .'Las views las sube el consumidor de app1 al procesar <span class="font-mono">commerce.product_viewed</span>.</p>'
            .'<form method="post" action="/products" class="flex items-center gap-2 mb-6">'
            .'<input name="name" placeholder="Nombre del producto" required class="bg-slate-950 border border-slate-700 focus:border-sky-500 focus:outline-none rounded px-3 py-1.5 text-sm text-white placeholder:text-slate-600 w-52">'
            .'<input name="price" type="number" step="0.01" min="0" placeholder="Precio" required class="bg-slate-950 border border-slate-700 focus:border-sky-500 focus:outline-none rounded px-3 py-1.5 text-sm text-white placeholder:text-slate-600 w-24 text-right">'
            .'<button type="submit" class="bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium px-3 py-1.5 rounded-md transition-colors">➕ Añadir producto</button>'
            .'</form>'
            .'<table class="w-full text-left text-sm">'
            .'<thead class="text-xs uppercase text-slate-500 border-b border-slate-800"><tr>'
            .'<th class="py-2">Producto</th><th class="py-2">Nombre</th>'
            .'<th class="py-2 text-right">Precio</th><th class="py-2 text-right">Views</th><th class="py-2 text-right">Editar</th>'
            .'</tr></thead>'
            ."<tbody>{$rows}</tbody></table>";

        return new Response(PageHtml::render('Back-office · catálogo', $content));
    }

    #[Route('/products', name: 'ops_products_add', methods: ['POST'])]
    public function add(Request $request): Response
    {
        $name = trim((string) $request->request->get('name'));
        $price = (float) $request->request->get('price');

        if ($name !== '') {
            ($this->addProduct)($name, $price);
        }

        return new RedirectResponse('/products', 303);
    }

    #[Route('/products/{id}', name: 'ops_products_update', methods: ['POST'])]
    public function update(Request $request, string $id): Response
    {
        $name = trim((string) $request->request->get('name'));
        $price = (float) $request->request->get('price');

        if ($name !== '') {
            ($this->updateProduct)($id, $name, $price);
        }

        return new RedirectResponse('/products', 303);
    }
}
