import { markdownResults, markdownMeasurement } from './markdown-corpus.ts';
export default {
  fetch(request: Request) {
    return Response.json(
      new URL(request.url).pathname === '/measure'
        ? markdownMeasurement()
        : markdownResults(),
    );
  },
};
