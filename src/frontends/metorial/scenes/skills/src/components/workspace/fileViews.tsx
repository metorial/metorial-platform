import { MonacoCodeEditor } from '@metorial/code-editor-monaco';
import { useFile, useUploadFile } from '@metorial/state';
import { FloatingSegmented, snackbar, Spinner, Text, theme } from '@metorial/ui';
import {
  RiAddLine,
  RiArrowDownSLine,
  RiArrowUpDownLine,
  RiArrowUpSLine,
  RiCheckboxCircleFill,
  RiCloseCircleLine,
  RiDownload2Line,
  RiFileCopyLine,
  RiInsertColumnRight,
  RiInsertRowBottom,
  RiSubtractLine,
  RiTextWrap,
  RiUpload2Line
} from '@remixicon/react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { forceFileTreeRefetch } from '../../scenes/skillStoreFileViewer';
import { useDownloadHref, usePreviewObjectUrl } from '../filePreview/load';
import { type PdfDocument, PdfPageCanvas, usePdfDocument } from '../filePreview/pdf';
import {
  formatSkillFileSize,
  getSkillCodeEditorLanguage,
  getSkillFileExtension,
  getSkillFileKind
} from '../textFile';
import {
  type SkillTextFileItem,
  type SkillTextFileSaveStatus,
  useSkillTextFile
} from '../useSkillTextFile';
import { normalizeCsvRows, parseCsv, serializeCsv } from './csv';
import {
  FilePane,
  FilePaneAction,
  FilePaneBody,
  FilePaneCenter,
  FilePaneSeparator
} from './filePane';
import { WorkspaceFileIcon } from './files';

let monoFont = '"JetBrains Mono", "SFMono-Regular", Menlo, Consolas, monospace';

export type SkillFileViewProps = {
  instanceId: string;
  storeId: string;
  itemId: string;
  item: SkillTextFileItem;
  readOnly: boolean;
  onItemChange: () => void;
};

let saveLabels: Record<SkillTextFileSaveStatus, string> = {
  saved: 'Saved',
  pending: 'Unsaved changes',
  saving: 'Saving…',
  error: 'Could not save'
};

let languageLabels: Record<string, string> = {
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  json: 'JSON',
  css: 'CSS',
  html: 'HTML',
  markdown: 'Markdown',
  python: 'Python',
  rust: 'Rust',
  shell: 'Shell',
  sql: 'SQL',
  xml: 'XML',
  yaml: 'YAML'
};

let joinMeta = (...parts: (string | null | undefined)[]) =>
  parts.filter(Boolean).join(' · ') || null;

let extensionChip = (path: string) => getSkillFileExtension(path).toUpperCase() || null;

let paneIcon = (path: string) => <WorkspaceFileIcon kind="file" name={path} />;

let PaneLoading = (p: { error?: string | null }) => (
  <FilePaneCenter>
    {p.error ? (
      <Text color="red600" size="2">
        {p.error}
      </Text>
    ) : (
      <Spinner size={18} />
    )}
  </FilePaneCenter>
);

let EditorFill = styled.div`
  height: 100%;
  min-height: 0;
`;

let copyText = async (text: string | null) => {
  if (text == null) return;
  try {
    await navigator.clipboard.writeText(text);
    snackbar.success('Copied to clipboard');
  } catch {
    snackbar.error('Could not copy to clipboard');
  }
};

let CodeFileView = (p: SkillFileViewProps) => {
  let textFile = useSkillTextFile(p);
  let [wrap, setWrap] = useState(false);
  let downloadHref = useDownloadHref(textFile.file.data?.downloadUrl);
  let language = getSkillCodeEditorLanguage(textFile.fileName);

  return (
    <FilePane
      icon={paneIcon(textFile.path)}
      path={textFile.path}
      chip={languageLabels[language] ?? extensionChip(textFile.path)}
      meta={joinMeta(
        formatSkillFileSize(textFile.file.data?.fileSize),
        p.readOnly ? 'Read only' : saveLabels[textFile.saveStatus]
      )}
      actions={
        <>
          <FilePaneAction
            icon={<RiTextWrap />}
            label="Wrap lines"
            active={wrap}
            onClick={() => setWrap(value => !value)}
          />
          <FilePaneSeparator />
          <FilePaneAction
            icon={<RiFileCopyLine />}
            label="Copy contents"
            onClick={() => void copyText(textFile.content)}
          />
          <FilePaneAction icon={<RiDownload2Line />} label="Download" href={downloadHref} />
        </>
      }
    >
      <FilePaneBody style={{ overflow: 'hidden' }}>
        {textFile.loadError || textFile.content == null ? (
          <PaneLoading error={textFile.loadError} />
        ) : (
          <EditorFill>
            <MonacoCodeEditor
              ariaLabel={`${textFile.fileName} editor`}
              fileName={textFile.fileName}
              language={language}
              onChange={textFile.setContent}
              readOnly={p.readOnly}
              value={textFile.content}
              wordWrap={wrap}
            />
          </EditorFill>
        )}
      </FilePaneBody>
      <textFile.uploadFile.RenderError />
    </FilePane>
  );
};

let Grid = styled.table`
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 13px;

  th,
  td {
    height: 36px;
    padding: 0 12px;
    border-right: 1px solid ${theme.colors.gray300};
    border-bottom: 1px solid ${theme.colors.gray300};
    text-align: left;
    white-space: nowrap;
  }

  th:last-child,
  td:last-child {
    border-right: 0;
  }

  thead th {
    position: sticky;
    top: 0;
    z-index: 1;
    background: ${theme.colors.gray100};
    color: ${theme.colors.gray700};
    font-family: ${monoFont};
    font-size: 12px;
    font-weight: 500;
  }

  tr.filler td {
    border-color: ${theme.colors.gray200};
  }
`;

let SortButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;

  svg {
    width: 12px;
    height: 12px;
    color: ${theme.colors.gray550};
  }
`;

let RowNumber = styled.td`
  width: 44px;
  color: ${theme.colors.gray550};
  font-family: ${monoFont};
  font-size: 11.5px;
  text-align: right !important;
`;

let Cell = styled.td<{ $numeric: boolean; $selected: boolean; $editable: boolean }>`
  ${({ $numeric }) =>
    $numeric
      ? `
    font-family: ${monoFont};
    font-size: 12.5px;
    text-align: right !important;
  `
      : ''}
  box-shadow: ${({ $selected }) =>
    $selected ? `inset 0 0 0 2px ${theme.colors.foreground}` : 'none'};
  cursor: ${({ $editable }) => ($editable ? 'cell' : 'default')};
`;

let CellInput = styled.input`
  width: 100%;
  min-width: 60px;
  padding: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: inherit;
  font: inherit;
`;

let BoolValue = styled.span<{ $yes: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: ${({ $yes }) => ($yes ? theme.colors.foreground : theme.colors.gray600)};

  svg {
    width: 14px;
    height: 14px;
  }
`;

let AddRow = styled.tr`
  td {
    color: ${theme.colors.gray600};
    font-size: 12.5px;
    cursor: pointer;
  }

  &:hover td {
    background: ${theme.colors.gray100};
  }

  svg {
    width: 13px;
    height: 13px;
    vertical-align: -2px;
  }
`;

let renderCellValue = (value: string) => {
  let lower = value.trim().toLowerCase();
  if (lower == 'yes' || lower == 'no' || lower == 'true' || lower == 'false') {
    let yes = lower == 'yes' || lower == 'true';
    return (
      <BoolValue $yes={yes}>
        {yes ? <RiCheckboxCircleFill /> : <RiCloseCircleLine />}
        {value}
      </BoolValue>
    );
  }
  return value;
};

let isNumeric = (value: string) => /^-?\d+(\.\d+)?$/.test(value.trim());

let TableFileView = (p: SkillFileViewProps) => {
  let textFile = useSkillTextFile(p);
  let [view, setView] = useState<'table' | 'raw'>('table');
  let [selected, setSelected] = useState<{ row: number; column: number } | null>(null);
  let [editing, setEditing] = useState<{ row: number; column: number } | null>(null);
  let [draft, setDraft] = useState('');
  let [sort, setSort] = useState<{ column: number; direction: 'asc' | 'desc' } | null>(null);
  let downloadHref = useDownloadHref(textFile.file.data?.downloadUrl);
  let editable = !p.readOnly;

  let rows = useMemo(
    () => normalizeCsvRows(parseCsv(textFile.content ?? '')),
    [textFile.content]
  );
  let header = rows[0] ?? [''];
  let body = rows.slice(1);
  let trailingNewline = (textFile.content ?? '').endsWith('\n');

  let order = useMemo(() => {
    let indexes = body.map((_, index) => index);
    if (!sort) return indexes;
    let direction = sort.direction == 'asc' ? 1 : -1;
    return indexes.sort((a, b) => {
      let left = body[a]![sort.column] ?? '';
      let right = body[b]![sort.column] ?? '';
      if (isNumeric(left) && isNumeric(right))
        return (Number(left) - Number(right)) * direction;
      return left.localeCompare(right) * direction;
    });
  }, [body, sort]);

  let commitRows = (next: string[][]) =>
    textFile.setContent(serializeCsv(next, trailingNewline || !textFile.content));

  let setCell = (row: number, column: number, value: string) => {
    let next = rows.map(cells => [...cells]);
    next[row]![column] = value;
    commitRows(next);
  };

  let addRow = () => {
    commitRows([...rows, Array(header.length).fill('')]);
    setSort(null);
  };

  let addColumn = () => {
    commitRows(
      rows.map((cells, index) => [...cells, index == 0 ? `column_${header.length + 1}` : ''])
    );
  };

  let startEditing = (row: number, column: number) => {
    if (!editable) return;
    setSelected({ row, column });
    setEditing({ row, column });
    setDraft(rows[row]?.[column] ?? '');
  };

  let finishEditing = (save: boolean) => {
    if (editing && save && draft != rows[editing.row]?.[editing.column]) {
      setCell(editing.row, editing.column, draft);
    }
    setEditing(null);
  };

  let renderCell = (row: number, column: number, value: string, isHeader: boolean) => {
    let isEditing = editing?.row == row && editing.column == column;
    if (isEditing) {
      return (
        <CellInput
          autoFocus
          value={draft}
          onChange={event => setDraft(event.target.value)}
          onBlur={() => finishEditing(true)}
          onKeyDown={event => {
            if (event.key == 'Enter') finishEditing(true);
            if (event.key == 'Escape') finishEditing(false);
          }}
        />
      );
    }
    return isHeader ? value : renderCellValue(value);
  };

  let content =
    textFile.loadError || textFile.content == null ? (
      <PaneLoading error={textFile.loadError} />
    ) : view == 'raw' ? (
      <EditorFill>
        <MonacoCodeEditor
          ariaLabel={`${textFile.fileName} editor`}
          fileName={textFile.fileName}
          language="plaintext"
          onChange={textFile.setContent}
          readOnly={p.readOnly}
          value={textFile.content}
        />
      </EditorFill>
    ) : (
      <Grid>
        <thead>
          <tr>
            <RowNumber as="th" />
            {header.map((name, column) => (
              <th
                key={column}
                onDoubleClick={() => startEditing(0, column)}
                style={{ cursor: editable ? 'cell' : undefined }}
              >
                {editing?.row == 0 && editing.column == column ? (
                  renderCell(0, column, name, true)
                ) : (
                  <SortButton
                    type="button"
                    onClick={() =>
                      setSort(current =>
                        current?.column != column
                          ? { column, direction: 'asc' }
                          : current.direction == 'asc'
                            ? { column, direction: 'desc' }
                            : null
                      )
                    }
                  >
                    {name}
                    {sort?.column == column ? (
                      sort.direction == 'asc' ? (
                        <RiArrowUpSLine />
                      ) : (
                        <RiArrowDownSLine />
                      )
                    ) : (
                      <RiArrowUpDownLine />
                    )}
                  </SortButton>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {order.map((bodyIndex, displayIndex) => {
            let row = bodyIndex + 1;
            return (
              <tr key={row}>
                <RowNumber>{displayIndex + 1}</RowNumber>
                {body[bodyIndex]!.map((value, column) => (
                  <Cell
                    key={column}
                    $numeric={isNumeric(value)}
                    $editable={editable}
                    $selected={editable && selected?.row == row && selected.column == column}
                    onClick={() => editable && setSelected({ row, column })}
                    onDoubleClick={() => startEditing(row, column)}
                  >
                    {renderCell(row, column, value, false)}
                  </Cell>
                ))}
              </tr>
            );
          })}
          {editable ? (
            <AddRow onClick={addRow}>
              <RowNumber>
                <RiAddLine />
              </RowNumber>
              <td colSpan={header.length}>New row</td>
            </AddRow>
          ) : null}
          {Array.from({ length: 14 }, (_, index) => (
            <tr key={`filler-${index}`} className="filler" aria-hidden>
              <RowNumber />
              {header.map((_, column) => (
                <td key={column} />
              ))}
            </tr>
          ))}
        </tbody>
      </Grid>
    );

  return (
    <FilePane
      icon={paneIcon(textFile.path)}
      path={textFile.path}
      chip="CSV"
      meta={joinMeta(
        `${Math.max(0, body.length)} rows`,
        formatSkillFileSize(textFile.file.data?.fileSize),
        p.readOnly ? 'Read only' : saveLabels[textFile.saveStatus]
      )}
      actions={
        <>
          <FloatingSegmented
            aria-label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'table', label: 'Table' },
              { value: 'raw', label: 'Raw' }
            ]}
          />
          {view == 'table' && editable ? (
            <>
              <FilePaneSeparator />
              <FilePaneAction icon={<RiInsertRowBottom />} label="Add row" onClick={addRow} />
              <FilePaneAction
                icon={<RiInsertColumnRight />}
                label="Add column"
                onClick={addColumn}
              />
            </>
          ) : null}
          <FilePaneSeparator />
          <FilePaneAction icon={<RiDownload2Line />} label="Download" href={downloadHref} />
        </>
      }
    >
      <FilePaneBody style={view == 'raw' ? { overflow: 'hidden' } : undefined}>
        {content}
      </FilePaneBody>
      <textFile.uploadFile.RenderError />
    </FilePane>
  );
};

let ZoomControls = (p: { zoom: number; onChange: (zoom: number) => void }) => (
  <>
    <FilePaneAction
      icon={<RiSubtractLine />}
      label="Zoom out"
      disabled={p.zoom <= 0.25}
      onClick={() => p.onChange(Math.max(0.25, Math.round((p.zoom - 0.25) * 100) / 100))}
    />
    <ZoomValue>{Math.round(p.zoom * 100)}%</ZoomValue>
    <FilePaneAction
      icon={<RiAddLine />}
      label="Zoom in"
      disabled={p.zoom >= 4}
      onClick={() => p.onChange(Math.min(4, Math.round((p.zoom + 0.25) * 100) / 100))}
    />
  </>
);

let ZoomValue = styled.span`
  min-width: 40px;
  color: ${theme.colors.gray700};
  font-size: 12px;
  text-align: center;
  white-space: nowrap;
`;

let Viewer = styled.div`
  display: grid;
  grid-template-columns: 1fr 220px;
  min-height: 100%;

  [data-size='xs'] &,
  [data-size='sm'] & {
    grid-template-columns: 1fr;
  }
`;

let Stage = styled.div`
  display: grid;
  place-items: center;
  min-height: 100%;
  padding: 40px;
  overflow: auto;
  box-sizing: border-box;
  background: ${theme.colors.gray100};
`;

let StageImage = styled.img`
  display: block;
  max-width: none;
  border-radius: 6px;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.06);
`;

let MetaList = styled.dl`
  display: grid;
  align-content: start;
  gap: 12px;
  margin: 0;
  padding: 16px;
  border-left: 1px solid ${theme.colors.gray300};
  font-size: 13px;

  dt {
    color: ${theme.colors.gray600};
    font-size: 12px;
  }

  dd {
    margin: 2px 0 0;
    overflow-wrap: anywhere;
  }

  [data-size='xs'] &,
  [data-size='sm'] & {
    display: none;
  }
`;

let useReplaceFile = (p: SkillFileViewProps) => {
  let uploadFile = useUploadFile();
  let inputRef = useRef<HTMLInputElement | null>(null);

  let replace = async (file: File) => {
    let itemFile = p.item.file;
    let [uploaded, error] = await uploadFile.mutate({
      instanceId: p.instanceId,
      file,
      title: p.item.path.split('/').pop() ?? file.name,
      purpose: itemFile?.purpose || 'generic',
      store: { id: p.storeId, path: p.item.path },
      storeReplace: true
    });
    if (error || !uploaded) {
      snackbar.error('Could not replace the file');
      return;
    }
    snackbar.success('File replaced');
    p.onItemChange();
    forceFileTreeRefetch();
  };

  let input = (
    <input
      ref={inputRef}
      type="file"
      hidden
      onChange={event => {
        let file = event.target.files?.[0];
        event.target.value = '';
        if (file) void replace(file);
      }}
    />
  );

  return { open: () => inputRef.current?.click(), input, loading: uploadFile.isLoading };
};

let useBinaryFile = (p: SkillFileViewProps) => {
  let file = useFile(p.instanceId, p.item.file?.id);
  let downloadHref = useDownloadHref(file.data?.downloadUrl);
  return { file, downloadHref };
};

let ImageFileView = (p: SkillFileViewProps) => {
  let { file, downloadHref } = useBinaryFile(p);
  let { objectUrl, error } = usePreviewObjectUrl(file.data?.downloadUrl);
  let [zoom, setZoom] = useState(1);
  let [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  let replace = useReplaceFile(p);

  useEffect(() => setDimensions(null), [objectUrl]);

  let fitWidth = dimensions ? Math.min(dimensions.width, 640) : undefined;

  return (
    <FilePane
      icon={paneIcon(p.item.path)}
      path={p.item.path}
      chip={extensionChip(p.item.path)}
      meta={joinMeta(
        dimensions ? `${dimensions.width} × ${dimensions.height}` : null,
        formatSkillFileSize(file.data?.fileSize)
      )}
      actions={
        <>
          <ZoomControls zoom={zoom} onChange={setZoom} />
          <FilePaneSeparator />
          {!p.readOnly ? (
            <FilePaneAction
              icon={<RiUpload2Line />}
              label="Replace"
              disabled={replace.loading}
              onClick={replace.open}
            />
          ) : null}
          <FilePaneAction icon={<RiDownload2Line />} label="Download" href={downloadHref} />
          {replace.input}
        </>
      }
    >
      <FilePaneBody>
        {!objectUrl ? (
          <PaneLoading error={error ?? file.error?.message} />
        ) : (
          <Viewer>
            <Stage>
              <StageImage
                alt={p.item.path}
                src={objectUrl}
                style={fitWidth ? { width: fitWidth * zoom } : undefined}
                onLoad={event =>
                  setDimensions({
                    width: event.currentTarget.naturalWidth,
                    height: event.currentTarget.naturalHeight
                  })
                }
              />
            </Stage>
            <MetaList>
              <div>
                <dt>Dimensions</dt>
                <dd>{dimensions ? `${dimensions.width} × ${dimensions.height}` : '—'}</dd>
              </div>
              <div>
                <dt>Size</dt>
                <dd>{formatSkillFileSize(file.data?.fileSize) ?? '—'}</dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>{file.data?.fileType ?? '—'}</dd>
              </div>
              {file.data?.createdBy?.name ? (
                <div>
                  <dt>Uploaded by</dt>
                  <dd>{file.data.createdBy.name}</dd>
                </div>
              ) : null}
            </MetaList>
          </Viewer>
        )}
      </FilePaneBody>
    </FilePane>
  );
};

let PdfView = styled.div`
  display: grid;
  grid-template-columns: 104px 1fr;
  min-height: 100%;

  [data-size='xs'] &,
  [data-size='sm'] & {
    grid-template-columns: 1fr;
  }
`;

let PdfRail = styled.div`
  position: sticky;
  top: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  align-self: start;
  gap: 10px;
  max-height: 100%;
  min-height: 100%;
  padding: 14px 0;
  overflow-y: auto;
  border-right: 1px solid ${theme.colors.gray300};
  box-sizing: border-box;

  [data-size='xs'] &,
  [data-size='sm'] & {
    display: none;
  }
`;

let PdfThumb = styled.button<{ $active: boolean }>`
  display: grid;
  justify-items: center;
  gap: 4px;
  padding: 0;
  border: 0;
  background: transparent;
  color: ${theme.colors.gray600};
  font: inherit;
  font-size: 11px;
  cursor: pointer;

  canvas {
    display: block;
    border: 1px solid ${theme.colors.gray300};
    border-radius: 3px;
    background: white;
    box-shadow: ${({ $active }) => ($active ? `0 0 0 2px ${theme.colors.foreground}` : 'none')};
  }
`;

let PdfPages = styled.div`
  display: grid;
  justify-items: center;
  align-content: start;
  gap: 16px;
  padding: 24px;
  background: ${theme.colors.gray100};
`;

let PdfPageFrame = styled.div`
  max-width: 100%;
  overflow: hidden;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 4px;
  background: white;
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.04),
    0 4px 14px rgba(0, 0, 0, 0.06);

  canvas {
    display: block;
  }
`;

let PdfPagePlaceholder = styled.div`
  aspect-ratio: 1 / 1.414;
`;

let PageLabel = styled.span`
  padding: 0 4px;
  color: ${theme.colors.gray700};
  font-size: 12px;
  white-space: nowrap;
`;

let LazyPdfPage = (p: {
  pdf: PdfDocument;
  pageNumber: number;
  width: number;
  root: HTMLElement | null;
  pageRef: (element: HTMLDivElement | null) => void;
}) => {
  let frameRef = useRef<HTMLDivElement | null>(null);
  let [visible, setVisible] = useState(p.pageNumber <= 2);

  useEffect(() => {
    if (visible || !frameRef.current) return;
    let observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) setVisible(true);
      },
      { root: p.root, rootMargin: '600px 0px' }
    );
    observer.observe(frameRef.current);
    return () => observer.disconnect();
  }, [visible, p.root]);

  return (
    <PdfPageFrame
      data-page={p.pageNumber}
      ref={element => {
        frameRef.current = element;
        p.pageRef(element);
      }}
      style={{ width: p.width }}
    >
      {visible ? (
        <PdfPageCanvas pdf={p.pdf} pageNumber={p.pageNumber} width={p.width} />
      ) : (
        <PdfPagePlaceholder />
      )}
    </PdfPageFrame>
  );
};

let PdfFileView = (p: SkillFileViewProps) => {
  let { file, downloadHref } = useBinaryFile(p);
  let { pdf, error } = usePdfDocument(file.data?.downloadUrl);
  let [zoom, setZoom] = useState(1);
  let [currentPage, setCurrentPage] = useState(1);
  let [bodyElement, setBodyElement] = useState<HTMLDivElement | null>(null);
  let pageElements = useRef(new Map<number, HTMLDivElement>());
  let pageCount = pdf?.numPages ?? 0;
  let pages = Array.from({ length: pageCount }, (_, index) => index + 1);
  let pageWidth = Math.round(560 * zoom);

  useEffect(() => {
    if (!bodyElement || !pageCount) return;
    let observer = new IntersectionObserver(
      entries => {
        let topmost = entries
          .filter(entry => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        let page = Number((topmost?.target as HTMLElement | undefined)?.dataset.page);
        if (page) setCurrentPage(page);
      },
      { root: bodyElement, threshold: 0.4 }
    );
    for (let element of pageElements.current.values()) observer.observe(element);
    return () => observer.disconnect();
  }, [bodyElement, pageCount, pageWidth]);

  let scrollToPage = (page: number) => {
    pageElements.current.get(page)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <FilePane
      icon={paneIcon(p.item.path)}
      path={p.item.path}
      chip="PDF"
      meta={formatSkillFileSize(file.data?.fileSize)}
      actions={
        <>
          {pageCount ? (
            <PageLabel>
              Page {currentPage} of {pageCount}
            </PageLabel>
          ) : null}
          <FilePaneSeparator />
          <ZoomControls zoom={zoom} onChange={setZoom} />
          <FilePaneSeparator />
          <FilePaneAction icon={<RiDownload2Line />} label="Download" href={downloadHref} />
        </>
      }
    >
      <FilePaneBody ref={setBodyElement}>
        {!pdf ? (
          <PaneLoading error={error ?? file.error?.message} />
        ) : (
          <PdfView>
            <PdfRail>
              {pages.map(page => (
                <PdfThumb
                  key={page}
                  type="button"
                  $active={page == currentPage}
                  aria-label={`Page ${page}`}
                  onClick={() => scrollToPage(page)}
                >
                  <PdfPageCanvas pdf={pdf} pageNumber={page} width={64} />
                  {page}
                </PdfThumb>
              ))}
            </PdfRail>
            <PdfPages>
              {pages.map(page => (
                <LazyPdfPage
                  key={page}
                  pdf={pdf}
                  pageNumber={page}
                  width={pageWidth}
                  root={bodyElement}
                  pageRef={element => {
                    if (element) pageElements.current.set(page, element);
                    else pageElements.current.delete(page);
                  }}
                />
              ))}
            </PdfPages>
          </PdfView>
        )}
      </FilePaneBody>
    </FilePane>
  );
};

let MediaStage = styled(FilePaneCenter)`
  background: ${theme.colors.gray100};

  video {
    max-width: 100%;
    max-height: 100%;
    border-radius: 8px;
    background: black;
  }

  audio {
    width: min(560px, 100%);
  }
`;

let MediaFileView = (p: SkillFileViewProps & { kind: 'video' | 'audio' }) => {
  let { file, downloadHref } = useBinaryFile(p);
  let { objectUrl, error } = usePreviewObjectUrl(file.data?.downloadUrl);

  return (
    <FilePane
      icon={paneIcon(p.item.path)}
      path={p.item.path}
      chip={extensionChip(p.item.path)}
      meta={formatSkillFileSize(file.data?.fileSize)}
      actions={
        <FilePaneAction icon={<RiDownload2Line />} label="Download" href={downloadHref} />
      }
    >
      <FilePaneBody>
        {!objectUrl ? (
          <PaneLoading error={error ?? file.error?.message} />
        ) : (
          <MediaStage>
            {p.kind == 'video' ? (
              <video controls src={objectUrl} />
            ) : (
              <audio controls src={objectUrl} />
            )}
          </MediaStage>
        )}
      </FilePaneBody>
    </FilePane>
  );
};

let BinaryFileView = (p: SkillFileViewProps) => {
  let { file, downloadHref } = useBinaryFile(p);

  return (
    <FilePane
      icon={paneIcon(p.item.path)}
      path={p.item.path}
      chip={extensionChip(p.item.path)}
      meta={formatSkillFileSize(file.data?.fileSize)}
      actions={
        <FilePaneAction icon={<RiDownload2Line />} label="Download" href={downloadHref} />
      }
    >
      <FilePaneBody>
        <FilePaneCenter>
          <Text size="3" weight="strong">
            Preview unavailable
          </Text>
          <Text color="gray600" size="2">
            This file type can't be previewed in the browser.
          </Text>
        </FilePaneCenter>
      </FilePaneBody>
    </FilePane>
  );
};

export let SkillFileView = (p: SkillFileViewProps): ReactNode => {
  let kind = getSkillFileKind({ fileName: p.item.path, fileType: p.item.file?.fileType });

  if (kind == 'code') return <CodeFileView key={p.itemId} {...p} />;
  if (kind == 'table') return <TableFileView key={p.itemId} {...p} />;
  if (kind == 'image') return <ImageFileView key={p.itemId} {...p} />;
  if (kind == 'pdf') return <PdfFileView key={p.itemId} {...p} />;
  if (kind == 'video' || kind == 'audio') {
    return <MediaFileView key={p.itemId} {...p} kind={kind} />;
  }
  return <BinaryFileView key={p.itemId} {...p} />;
};
