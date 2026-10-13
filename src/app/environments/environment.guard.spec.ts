import { environment } from '../../environments/environment';

// Regression guards for the API configuration. These catch accidental
// localhost endpoints and obsolete branding from shipping, while allowing
// localhost for live-backend testing in non-production builds.
describe('production environment guard', () => {
  it('production never uses mock mode or localhost', () => {
    if (!environment.production) return;
    expect(environment.useMockApi).toBeFalse();
    expect(environment.apiBaseUrl.startsWith('https://')).toBeTrue();
    expect(environment.apiBaseUrl.includes('localhost')).toBeFalse();
    expect(environment.apiBaseUrl.includes('127.0.0.1')).toBeFalse();
  });

  it('live apiBaseUrl is http(s) and never a placeholder in live mode', () => {
    if (environment.useMockApi) return;
    expect(environment.apiBaseUrl).toMatch(/^https?:\/\//);
    expect(environment.apiBaseUrl.includes('api.example.com')).toBeFalse();
  });

  it('app name is Pharora-branded (no obsolete NovaMart)', () => {
    expect(environment.appName.toLowerCase()).toContain('pharora');
    expect(environment.appName.toLowerCase()).not.toContain('nova');
    expect(environment.supportEmail.toLowerCase()).not.toContain('nova');
  });
});
