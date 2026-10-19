import { issueFormCorpusResults } from './issue-form-corpus.ts';
export default {
  fetch() {
    return Response.json(issueFormCorpusResults());
  },
};
