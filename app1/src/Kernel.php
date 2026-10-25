<?php

declare(strict_types=1);

namespace App;

use Symfony\Bundle\FrameworkBundle\FrameworkBundle;
use Symfony\Bundle\FrameworkBundle\Kernel\MicroKernelTrait;
use Symfony\Component\DependencyInjection\Loader\Configurator\ContainerConfigurator;
use Symfony\Component\HttpKernel\Kernel as HttpKernel;
use Symfony\Component\Routing\Loader\Configurator\RoutingConfigurator;

final class Kernel extends HttpKernel
{
    use MicroKernelTrait;

    public function registerBundles(): iterable
    {
        yield new FrameworkBundle();
    }

    protected function configureContainer(ContainerConfigurator $container): void
    {
        $container->import(__DIR__.'/../config/packages/framework.yaml');
        $container->import(__DIR__.'/../config/services.yaml');
    }

    protected function configureRoutes(RoutingConfigurator $routes): void
    {
        // Controllers con #[Route]: UI de ops + endpoint de consume de la cola
        $routes->import(__DIR__.'/Ops/Orders/Infrastructure/Controller', 'attribute');
        $routes->import(__DIR__.'/Ops/Products/Infrastructure/Controller', 'attribute');
        $routes->import(__DIR__.'/Shared/Infrastructure/Controller', 'attribute');
    }

    public function getCacheDir(): string
    {
        $dir = $this->getProjectDir().'/var/cache/'.$this->environment;
        is_dir($dir) || mkdir($dir, 0777, true);

        return $dir;
    }

    public function getLogDir(): string
    {
        $dir = $this->getProjectDir().'/var/log';
        is_dir($dir) || mkdir($dir, 0777, true);

        return $dir;
    }
}
