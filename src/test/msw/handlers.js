import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('*/chat/completions', async () =>
    HttpResponse.json({
      choices: [{ message: { content: 'default mocked completion' } }],
    })
  ),
];
