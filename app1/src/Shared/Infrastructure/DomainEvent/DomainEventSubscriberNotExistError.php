<?php

declare(strict_types=1);

namespace App\Shared\Infrastructure\DomainEvent;

final class DomainEventSubscriberNotExistError extends CodelyError
{
    public function __construct(string $subscriberName)
    {
        parent::__construct(\sprintf('DomainEventSubscriberNotExistError: %s', $subscriberName));
    }
}
