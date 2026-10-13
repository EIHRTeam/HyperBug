import {
  decodeIssueFormYaml,
  IssueFormYamlError,
} from '../../packages/security/src/issue-form-yaml.ts';
import {
  normalizeIssueFormDefinition,
  validateIssueFormAnswers,
  IssueFormError,
  assertActiveIssueFormVersion,
} from '@hyperbug/application';

export const attachmentA = '20000000-0000-4000-8000-000000000001';
export const attachmentB = '20000000-0000-4000-8000-000000000002';
export const completeIssueFormYaml = `name: Bug report
description: Report a reproducible bug
title: "[Bug] "
labels: bug, triage
assignees: [maintainer]
type: Bug
body:
  - type: markdown
    attributes:
      value: |
        ## Please read
        % harmless text
        <script>untrusted notice</script>
  - type: input
    id: version
    attributes:
      label: Version
      description: Version you tested
      placeholder: 1.0.0
      value: 1.0.0
    validations:
      required: true
      min_length: 3
  - type: textarea
    id: steps
    attributes:
      label: Steps
      description: What happened?
      placeholder: Describe the steps
      value: |
        1. Start
      render: bash
    validations:
      required: true
      min_length: 3
  - type: dropdown
    id: platform
    attributes:
      label: Platform
      description: Select one platform
      options: [Windows, Linux]
      multiple: false
      default: 1
    validations:
      required: true
  - type: dropdown
    id: components
    attributes:
      label: Components
      options: [API, UI]
      multiple: true
      default: 0
  - type: checkboxes
    id: consent
    attributes:
      label: Consent
      description: Read the **policy**
      options:
        - label: I agree to the [policy](/policy)
          required: true
        - label: Contact me
    validations:
      required: true
  - type: upload
    id: files
    attributes:
      label: Evidence
      description: Attach logs
    validations:
      required: true
      accept: ".PNG, .tar.gz, .log"
`;
export const validFormAnswers = {
  version: '1.0.0',
  steps: 'echo ok\r\n```\r\n# still code',
  platform: 'Linux',
  components: ['UI', 'API'],
  consent: [1, 0],
  files: [attachmentB, attachmentA],
};
const minimal = `name: Test\ndescription: Test form\nbody:\n- type: input\n  attributes:\n    label: Question\n`;
export const rejectedIssueFormYaml = [
  '',
  '[]',
  'null',
  minimal + '---\nname: second\n',
  minimal.replace('name: Test', 'name: Test\nname: Duplicate'),
  minimal.replace('name: Test', 'name: !unknown Test'),
  minimal.replace('name: Test', 'name: !!str Test'),
  minimal.replace('name: Test', 'name: &a Test'),
  minimal.replace('description: Test form', 'description: *missing'),
  minimal.replace('name: Test', '%YAML 1.1\n---\nname: Test'),
  minimal + 'nested: &a [*a, *a]\n',
  minimal + '__proto__: polluted\n',
  minimal + 'constructor: polluted\n',
  minimal + '<<: {name: merged}\n',
  minimal + '? [a,b]\n: value\n',
  minimal + 'extra: .nan\n',
  minimal + 'extra: .inf\n',
  minimal + 'extra: ' + '['.repeat(20) + 'x' + ']'.repeat(20),
  minimal + '\n' + ' '.repeat(49) + 'deep: true',
  minimal + '\n' + '- '.repeat(20) + 'x',
  minimal + '\0',
  minimal + '\ud800',
  'x'.repeat(32769),
  minimal.replace('type: input', 'type: boolean'),
  minimal.replace('label: Question', 'label: Question\n    unknown: true'),
  minimal.replace(
    'label: Question',
    'label: Question\n  validations:\n    required: yes',
  ),
  minimal.replace('label: Question', 'label: Question\n  id: __proto__'),
  minimal + 'projects: [org/1]',
  minimal + 'blank_issues_enabled: false',
  minimal.replace('name: Test', 'name: 123'),
  minimal.replace('label: Question', 'label: false'),
];
function errorCode(action: () => unknown): string {
  try {
    action();
    return 'accepted';
  } catch (error) {
    if (error instanceof IssueFormYamlError) return `yaml:${error.reason}`;
    if (error instanceof IssueFormError) return error.code;
    throw error;
  }
}
export function issueFormCorpusResults() {
  const definition = normalizeIssueFormDefinition(
    decodeIssueFormYaml(completeIssueFormYaml),
  );
  const submission = validateIssueFormAnswers(definition, validFormAnswers);
  const alternate = validateIssueFormAnswers(definition, {
    ...validFormAnswers,
    components: ['API', 'UI'],
    consent: [0, 1],
    files: [attachmentA, attachmentB],
  });
  const invalidAnswers = [
    { ...validFormAnswers, version: '' },
    { ...validFormAnswers, version: 'x' },
    { ...validFormAnswers, version: 'a\nb' },
    { ...validFormAnswers, version: '\ud800' },
    { ...validFormAnswers, version: '🐛'.repeat(1025) },
    { ...validFormAnswers, version: null },
    { ...validFormAnswers, platform: 'Solaris' },
    { ...validFormAnswers, platform: ['Linux'] },
    { ...validFormAnswers, components: ['API', 'API'] },
    { ...validFormAnswers, components: 'API' },
    { ...validFormAnswers, consent: [1] },
    { ...validFormAnswers, consent: [] },
    { ...validFormAnswers, consent: [0, 0] },
    { ...validFormAnswers, consent: [0.5] },
    { ...validFormAnswers, consent: ['0'] },
    { ...validFormAnswers, consent: [0, 2] },
    { ...validFormAnswers, files: [] },
    { ...validFormAnswers, files: ['invalid'] },
    { ...validFormAnswers, files: [attachmentA, attachmentA] },
    { ...validFormAnswers, files: [attachmentA.replace('2000', 'XXXX')] },
    { ...validFormAnswers, 'field-1': 'a notice answer' },
    { ...validFormAnswers, extra: true },
    JSON.parse('{"__proto__":{ "polluted":true }}'),
  ];
  return {
    definition,
    submission,
    alternate,
    minimal: normalizeIssueFormDefinition(decodeIssueFormYaml(minimal)),
    revalidated: normalizeIssueFormDefinition(
      JSON.parse(JSON.stringify(definition)),
      'canonical',
    ),
    rejectedYaml: rejectedIssueFormYaml.map((yaml) =>
      errorCode(() => normalizeIssueFormDefinition(decodeIssueFormYaml(yaml))),
    ),
    rejectedAnswers: invalidAnswers.map((answers) =>
      errorCode(() => validateIssueFormAnswers(definition, answers)),
    ),
    versions: [
      errorCode(() => assertActiveIssueFormVersion(true, 2, 1)),
      errorCode(() => assertActiveIssueFormVersion(false, 2, 2)),
      errorCode(() => assertActiveIssueFormVersion(true, 2, 2)),
    ],
  };
}
