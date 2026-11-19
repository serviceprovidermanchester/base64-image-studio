name: Bug Report
description: Create a report to help us improve Base64 Image Studio
title: "[BUG]: "
labels: ["bug"]
body:
  - type: markdown
    attributes:
      value: Thank you for reporting an issue! Please describe the problem clearly.
  - type: textarea
    id: description
    attributes:
      label: Bug Description
      description: What happened?
    validations:
      required: true
  - type: textarea
    id: steps
    attributes:
      label: Steps to Reproduce
      description: Detail steps to reproduce the issue.
    validations:
      required: true
  - type: input
    id: environment
    attributes:
      label: Operating System & Browser
      description: e.g. Windows 11, Chrome 120
    validations:
      required: true
