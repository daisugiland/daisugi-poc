import { Result } from '@daisugi/anzen';
import type { ResultFailure } from '@daisugi/anzen';
import { Code } from '@daisugi/kintsugi';

import type {
  FailException,
  Handler,
  HandlerDecorator,
  StopPropagationException,
  Toolkit,
} from './types.js';

export type { Handler, Toolkit } from './types.js';

// Duck type validation.
function isFnAsync(handler: Handler) {
  return handler.constructor.name === 'AsyncFunction';
}

function decorateHandler(
  userHandler: Handler,
  userHandlerDecorators: HandlerDecorator[],
  nextHandler: Handler | null,
): Handler {
  const isAsync = isFnAsync(userHandler);
  const { injectToolkit } = userHandler.meta || {};
  let toolkit: Partial<Toolkit>;
  // Declare `toolkit` variable.
  if (injectToolkit) {
    toolkit = {
      nextWith(...args) {
        if (nextHandler) {
          return nextHandler(...args);
        }

        return null;
      },
      failWith: Daisugi.failWith,
    };
  }

  const decoratedUserHandler = userHandlerDecorators.reduce(
    (currentUserHandler, userHandlerDecorator) => {
      const decoratedHandler = userHandlerDecorator(
        currentUserHandler,
        toolkit as Toolkit,
      );
      decoratedHandler.meta = currentUserHandler.meta;
      return decoratedHandler;
    },
    userHandler,
  );

  // Maybe use of arguments instead.
  function handler(...args: any[]) {
    // Duck type condition, maybe use instanceof and result class here.
    if (args[0]?.isFailure) {
      const firstArg = args[0];
      if (firstArg.getError().code === Code.Fail) {
        return firstArg;
      }
      if (
        firstArg.getError().code === Code.StopPropagation
      ) {
        return firstArg.getError().value;
      }
    }
    if (injectToolkit) {
      // Add runtime `toolkit` properties whose depend of the arguments.
      Object.defineProperty(toolkit, 'next', {
        get() {
          return (toolkit as Toolkit).nextWith(...args);
        },
        configurable: true,
      });
      return decoratedUserHandler(...args, toolkit);
    }
    if (!nextHandler) {
      return decoratedUserHandler(...args);
    }
    if (isAsync) {
      return decoratedUserHandler(...args).then(
        nextHandler,
      );
    }
    if (nextHandler.__meta__!.isAsync) {
      return Promise.resolve(
        decoratedUserHandler(...args),
      ).then(nextHandler);
    }
    return nextHandler(decoratedUserHandler(...args));
  }
  handler.__meta__ = { isAsync };
  return handler;
}

function createSequenceOf(
  userHandlerDecorators: HandlerDecorator[],
) {
  return function (userHandlers: Handler[]) {
    return userHandlers.reduceRight<Handler>(
      (nextHandler, userHandler) => {
        return decorateHandler(
          userHandler,
          userHandlerDecorators,
          nextHandler,
        );
      },
      null!,
    );
  };
}

export class Daisugi {
  sequenceOf;

  constructor(
    userHandlerDecorators: HandlerDecorator[] = [],
  ) {
    this.sequenceOf = createSequenceOf(
      userHandlerDecorators,
    );
  }

  static stopPropagationWith(
    value: any,
  ): ResultFailure<StopPropagationException> {
    return Result.failure({
      code: Code.StopPropagation,
      value,
    });
  }

  static failWith(
    value: any,
  ): ResultFailure<FailException> {
    return Result.failure({ code: Code.Fail, value });
  }
}
