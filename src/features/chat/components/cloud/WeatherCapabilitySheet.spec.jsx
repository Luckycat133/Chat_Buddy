/**
 * WeatherCapabilitySheet — consent entry (WEB_IMPLEMENTATION §19).
 * Verifies: loads current settings truthfully, saving posts the consent
 * toggle + city and closes, and failures surface as alerts (never fake
 * success).
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WeatherCapabilitySheet from './WeatherCapabilitySheet';
import { LanguageProvider } from '../../../../context/LanguageContext';

const cloudMocks = vi.hoisted(() => ({
  authedCloudFetch: vi.fn(),
  cloudEnabled: vi.fn(() => true),
}));

vi.mock('../../../../api/cloud-adapter', () => cloudMocks);

function renderSheet(props = {}) {
  return render(
    <LanguageProvider>
      <WeatherCapabilitySheet open onClose={vi.fn()} {...props} />
    </LanguageProvider>,
  );
}

function settingsResponse(overrides = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      weatherCity: null,
      weatherConsent: false,
      calendarProvider: null,
      calendarConnectedAt: null,
      ...overrides,
    }),
  };
}

describe('WeatherCapabilitySheet', () => {
  beforeEach(() => {
    cloudMocks.authedCloudFetch.mockReset();
    cloudMocks.cloudEnabled.mockReturnValue(true);
  });

  it('loads the current consent state and default city', async () => {
    cloudMocks.authedCloudFetch.mockResolvedValue(
      settingsResponse({ weatherConsent: true, weatherCity: '北京' }),
    );
    renderSheet();

    await waitFor(() =>
      expect(cloudMocks.authedCloudFetch).toHaveBeenCalledWith(
        '/v1/capabilities/settings',
      ),
    );
    await waitFor(() =>
      expect(screen.getByTestId('weather-consent-toggle')).toBeChecked(),
    );
    expect(screen.getByTestId('weather-city-input')).toHaveValue('北京');
  });

  it('saves the consent toggle and city through the settings endpoint', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    cloudMocks.authedCloudFetch
      .mockResolvedValueOnce(settingsResponse())
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) });
    renderSheet({ onClose });

    await waitFor(() =>
      expect(screen.getByTestId('weather-consent-toggle')).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId('weather-consent-toggle'));
    await user.type(screen.getByTestId('weather-city-input'), '上海');
    await user.click(screen.getByTestId('weather-save-button'));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(cloudMocks.authedCloudFetch).toHaveBeenLastCalledWith(
      '/v1/capabilities/settings',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"weatherConsent":true'),
      }),
    );
    const lastCall = cloudMocks.authedCloudFetch.mock.calls.at(-1);
    expect(JSON.parse(lastCall[1].body)).toEqual({
      weatherConsent: true,
      weatherCity: '上海',
    });
  });

  it('surfaces save failures as an alert instead of closing', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    cloudMocks.authedCloudFetch
      .mockResolvedValueOnce(settingsResponse())
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({
          error: { code: 'INTERNAL', message: 'gateway down' },
        }),
      });
    renderSheet({ onClose });

    await waitFor(() =>
      expect(screen.getByTestId('weather-save-button')).toBeInTheDocument(),
    );
    await user.click(screen.getByTestId('weather-save-button'));

    await waitFor(() =>
      expect(screen.getByTestId('weather-save-error')).toHaveTextContent(
        /gateway down/,
      ),
    );
    expect(screen.getByTestId('weather-save-error')).toHaveAttribute(
      'role',
      'alert',
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows a load failure alert when settings cannot be read', async () => {
    cloudMocks.authedCloudFetch.mockRejectedValue(new Error('offline'));
    renderSheet();

    await waitFor(() =>
      expect(screen.getByTestId('weather-settings-error')).toHaveTextContent(
        /offline/,
      ),
    );
    expect(screen.getByTestId('weather-settings-error')).toHaveAttribute(
      'role',
      'alert',
    );
  });
});
