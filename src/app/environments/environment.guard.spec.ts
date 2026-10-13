import { environment } from '../../environments/environment';

// Regression guards for the production/demo configuration. These catch
// accidental localhost API endpoints and obsolete branding from shipping.
describe('production environment guard', () => {
  it('apiBaseUrl is https and never localhost/loopback', () => {
    expect(environment.apiBaseUrl.startsWith('https://')).toBeTrue();
    expect(environment.apiBaseUrl.includes('localhost')).toBeFalse();
    expect(environment.apiBaseUrl.includes('127.0.0.1')).toBeFalse();
  });

  it('app name is Pharora-branded (no obsolete NovaMart)', () => {
    expect(environment.appName.toLowerCase()).toContain('pharora');
    expect(environment.appName.toLowerCase()).not.toContain('nova');
    expect(environment.supportEmail.toLowerCase()).not.toContain('nova');
  });
});
