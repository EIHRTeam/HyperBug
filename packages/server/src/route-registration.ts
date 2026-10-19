import { t, type AnyElysia } from 'elysia';
import type { AppOptions, BoundaryHeaders } from './index.ts';
import {
  RegistrationAcceptedSchema,
  RegistrationChallengeSchema,
  RegistrationRequestSchema,
  type RegistrationRequest,
  type RegistrationAccepted,
  type RegistrationChallenge,
} from '@hyperbug/contracts';
import { type CaptchaGate } from './captcha.ts';
import { registerAccount } from './account-registration.ts';
export interface RegistrationDependencies {
  readonly captchaGate: CaptchaGate;
  readonly publicCaptchaSiteKey: string | null;
  readonly boundaryFor: (request: Request) => BoundaryHeaders;
  readonly registrationStore: AppOptions['registrationStore'];
}
export function registrationRoutes(
  app: AnyElysia,
  dependencies: RegistrationDependencies,
) {
  const { captchaGate, publicCaptchaSiteKey, boundaryFor, registrationStore } =
    dependencies;
  return app
    .get(
      '/api/v1/accounts/register',
      (): RegistrationChallenge => ({
        captchaRequired: captchaGate.enabled,
        captchaSiteKey: publicCaptchaSiteKey,
        captchaAction: 'register',
      }),
      {
        response: t.Unsafe<RegistrationChallenge>(RegistrationChallengeSchema),
      },
    )
    .post(
      '/api/v1/accounts/register',
      async ({
        request,
        body,
        set,
        sensitiveAdmission,
        accountPassword: passwordService,
      }) => {
        const result = await registerAccount({
          request,
          body,
          admission: sensitiveAdmission,
          password: passwordService?.forRequest?.(request) ?? passwordService,
          requestId: boundaryFor(request).requestId,
          store: registrationStore ?? null,
        });
        set.status = 202;
        return result;
      },
      {
        body: t.Unsafe<RegistrationRequest>(RegistrationRequestSchema),
        response: {
          202: t.Unsafe<RegistrationAccepted>(RegistrationAcceptedSchema),
        },
      },
    );
}
