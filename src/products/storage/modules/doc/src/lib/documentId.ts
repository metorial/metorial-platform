export let documentIdPattern = /^doc_[0-9A-Za-z]{10,64}$/;

export let isDocumentId = (value: string) => documentIdPattern.test(value);
