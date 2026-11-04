import { useReactFlow } from '@xyflow/react';
import { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { asset, uploadDemo, uploadFile } from '../content/api';
import { normalizeAngle } from '../nodes/RotateHandle';
import { type FlowEdge, type FlowNode, useMapStore } from '../store/mapStore';
import {
  CODE_LANGUAGES,
  type CodeLanguage,
  DEVICES,
  LABEL_FONTS,
  LABEL_WEIGHTS,
  type LabelFont,
  NOTE_COLORS,
  type NodeDataOf,
  type NodeType,
  type NoteColor,
  SHAPE_KINDS,
  TEXT_SIZES,
  type TextSize,
} from '../store/schema';
import { useUiStore } from '../store/uiStore';
import { Button } from '../ui/Button';
import { tokenValues } from '../ui/tokens';
import styles from './Editor.module.css';

type OnError = (message: string) => void;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control is passed as children
    <label className={styles.field}>
      {label}
      {children}
    </label>
  );
}

/** A button that opens a file picker and uploads the result. */
function UploadButton({
  label,
  accept,
  folder,
  multiple,
  onFiles,
}: {
  label: string;
  accept?: string;
  folder?: boolean;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const folderProps = folder ? { webkitdirectory: '' } : {};
  return (
    <>
      <Button onClick={() => input.current?.click()}>{label}</Button>
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        className={styles.hidden}
        {...folderProps}
        onChange={(e) => {
          if (e.target.files?.length) onFiles(Array.from(e.target.files));
          e.target.value = '';
        }}
      />
    </>
  );
}

function useUpdate<T extends NodeType>(id: string) {
  const updateNodeData = useMapStore((s) => s.updateNodeData);
  return (patch: Partial<NodeDataOf<T>>) => updateNodeData<T>(id, patch);
}

const NOTE_COLOR_NAMES: Record<NoteColor, string> = {
  yellow: 'Yellow',
  pink: 'Pink',
  green: 'Green',
  blue: 'Blue',
  purple: 'Purple',
};

const TEXT_SIZE_LABELS: Record<TextSize, string> = { sm: 'S', md: 'M', lg: 'L', xl: 'XL' };

const TEXT_SIZE_NAMES: Record<TextSize, string> = {
  sm: 'Small',
  md: 'Medium',
  lg: 'Large',
  xl: 'Extra large',
};

/** S / M / L / XL segmented control for a text node's or note's text size. */
function TextSizeField({
  nodeId,
  value,
  onChange,
}: {
  nodeId: string;
  value: TextSize;
  onChange: (size: TextSize) => void;
}) {
  return (
    <fieldset className={`${styles.field} ${styles.fieldset}`}>
      <legend className={styles.legend}>Text size</legend>
      <div className={styles.segmented}>
        {TEXT_SIZES.map((size) => (
          <label key={size} className={styles.segment} title={TEXT_SIZE_NAMES[size]}>
            <input
              type="radio"
              name={`text-size-${nodeId}`}
              value={size}
              checked={value === size}
              aria-label={TEXT_SIZE_NAMES[size]}
              onChange={() => onChange(size)}
            />
            <span aria-hidden="true">{TEXT_SIZE_LABELS[size]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const WEIGHT_NAMES: Record<(typeof LABEL_WEIGHTS)[number], string> = {
  400: 'Regular',
  500: 'Medium',
  600: 'Semibold',
  700: 'Bold',
};

function LabelFields({ node }: { node: Extract<FlowNode, { type: 'label' }> }) {
  const update = useUpdate<'label'>(node.id);
  return (
    <>
      <Field label="Font">
        <select
          value={node.data.font}
          onChange={(e) => update({ font: e.target.value as LabelFont })}
        >
          {Object.entries(LABEL_FONTS).map(([value, name]) => (
            <option key={value} value={value}>
              {name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Size (px)">
        <div className={styles.sizeRow}>
          <input
            type="range"
            min={8}
            max={240}
            value={node.data.size}
            aria-label="Size slider"
            onChange={(e) => update({ size: Number(e.target.value) })}
          />
          <input
            type="number"
            min={8}
            max={240}
            value={node.data.size}
            onChange={(e) => {
              const size = Number(e.target.value);
              if (size >= 8 && size <= 240) update({ size });
            }}
          />
        </div>
      </Field>
      <fieldset className={`${styles.field} ${styles.fieldset}`}>
        <legend className={styles.legend}>Weight</legend>
        <div className={styles.segmented}>
          {LABEL_WEIGHTS.map((weight) => (
            <label key={weight} className={styles.segment} title={WEIGHT_NAMES[weight]}>
              <input
                type="radio"
                name={`label-weight-${node.id}`}
                checked={node.data.weight === weight}
                aria-label={WEIGHT_NAMES[weight]}
                onChange={() => update({ weight })}
              />
              <span aria-hidden="true" style={{ fontWeight: weight }}>
                Aa
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className={styles.hint}>Double-click the label on the canvas to type. Esc to finish.</p>
    </>
  );
}

function NoteFields({ node }: { node: Extract<FlowNode, { type: 'note' }> }) {
  const update = useUpdate<'note'>(node.id);
  return (
    <>
      <fieldset className={`${styles.field} ${styles.fieldset}`}>
        <legend className={styles.legend}>Color</legend>
        <div className={styles.swatches}>
          {NOTE_COLORS.map((color) => (
            <label
              key={color}
              className={styles.swatch}
              style={{ background: `var(--color-note-${color})` }}
              title={NOTE_COLOR_NAMES[color]}
            >
              <input
                type="radio"
                name={`note-color-${node.id}`}
                value={color}
                checked={node.data.color === color}
                aria-label={NOTE_COLOR_NAMES[color]}
                onChange={() => update({ color })}
              />
            </label>
          ))}
        </div>
      </fieldset>
      <TextSizeField
        nodeId={node.id}
        value={node.data.size}
        onChange={(size) => update({ size })}
      />
      <div className={styles.row}>
        <Field label="Rotation (°)">
          <input
            type="number"
            min={-180}
            max={180}
            step={1}
            value={node.data.rotation}
            onChange={(e) => {
              const deg = Number(e.target.value);
              if (Number.isFinite(deg)) update({ rotation: normalizeAngle(deg) });
            }}
          />
        </Field>
        <Button className={styles.alignEnd} onClick={() => update({ rotation: 0 })}>
          Straighten
        </Button>
      </div>
      <p className={styles.hint}>
        Double-click the note on the canvas to write. Esc to finish. Drag the dot above it to rotate
        (Shift snaps to 15°).
      </p>
    </>
  );
}

function StackFields({ node }: { node: Extract<FlowNode, { type: 'stack' }> }) {
  return (
    <>
      <p className={styles.hint}>
        {node.data.items.length} images. Visitors click the stack to spread them out; double-click
        to preview. Right-click it to unstack.
      </p>
      <Button onClick={() => useMapStore.getState().unstack(node.id)}>Unstack</Button>
    </>
  );
}

function CodeFields({ node }: { node: Extract<FlowNode, { type: 'code' }> }) {
  const update = useUpdate<'code'>(node.id);
  return (
    <>
      <Field label="Language">
        <select
          value={node.data.language}
          onChange={(e) => update({ language: e.target.value as CodeLanguage })}
        >
          {Object.entries(CODE_LANGUAGES).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="File name (optional)">
        <input
          value={node.data.title}
          placeholder="e.g. Button.tsx"
          onChange={(e) => update({ title: e.target.value })}
        />
      </Field>
      <label className={`${styles.field} ${styles.check}`}>
        <input
          type="checkbox"
          checked={node.data.lineNumbers}
          onChange={(e) => update({ lineNumbers: e.target.checked })}
        />
        Line numbers
      </label>
      <label className={`${styles.field} ${styles.check}`}>
        <input
          type="checkbox"
          checked={node.data.wrap}
          onChange={(e) => update({ wrap: e.target.checked })}
        />
        Wrap long lines
      </label>
      <p className={styles.hint}>Double-click the block to edit. Tab indents, Esc finishes.</p>
    </>
  );
}

function TextFields({ node }: { node: Extract<FlowNode, { type: 'text' }> }) {
  const update = useUpdate<'text'>(node.id);
  return (
    <>
      <Field label="Background">
        <select
          value={node.data.background ?? ''}
          onChange={(e) => update({ background: e.target.value || undefined })}
        >
          <option value="">Card</option>
          <option value="transparent">None</option>
        </select>
      </Field>
      <TextSizeField
        nodeId={node.id}
        value={node.data.size}
        onChange={(size) => update({ size })}
      />
      <Button onClick={() => useUiStore.getState().setReader(node.id)}>Edit full screen</Button>
      <p className={styles.hint}>
        Double-click the text to edit it full screen. Back or Esc to finish; visitors open the same
        view with a click.
      </p>
    </>
  );
}

function ShapeFields({ node }: { node: Extract<FlowNode, { type: 'shape' }> }) {
  const update = useUpdate<'shape'>(node.id);
  return (
    <>
      <Field label="Shape">
        <select
          value={node.data.shape}
          onChange={(e) => update({ shape: e.target.value as NodeDataOf<'shape'>['shape'] })}
        >
          {SHAPE_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </select>
      </Field>
      <div className={styles.row}>
        <Field label="Fill">
          <input
            type="color"
            value={node.data.fill}
            onChange={(e) => update({ fill: e.target.value })}
          />
        </Field>
        <Field label="Stroke">
          <input
            type="color"
            value={node.data.stroke}
            onChange={(e) => update({ stroke: e.target.value })}
          />
        </Field>
      </div>
      <Field label="Label">
        <textarea value={node.data.label} onChange={(e) => update({ label: e.target.value })} />
      </Field>
    </>
  );
}

function ImageFields({
  node,
  onError,
}: {
  node: Extract<FlowNode, { type: 'image' }>;
  onError: OnError;
}) {
  const update = useUpdate<'image'>(node.id);
  return (
    <>
      <UploadButton
        label={node.data.src ? 'Replace image' : 'Choose image'}
        accept="image/*"
        onFiles={([file]) =>
          uploadFile(file)
            .then(({ src }) => update({ src }))
            .catch((err: Error) => onError(err.message))
        }
      />
      <Field label="Alt text">
        <input value={node.data.alt} onChange={(e) => update({ alt: e.target.value })} />
      </Field>
      <Field label="Fit">
        <select
          value={node.data.fit}
          onChange={(e) => update({ fit: e.target.value as 'contain' | 'cover' })}
        >
          <option value="contain">Contain</option>
          <option value="cover">Cover (crop)</option>
        </select>
      </Field>
    </>
  );
}

function VideoFields({
  node,
  onError,
}: {
  node: Extract<FlowNode, { type: 'video' }>;
  onError: OnError;
}) {
  const update = useUpdate<'video'>(node.id);
  const upload = (key: 'src' | 'poster') => (files: File[]) =>
    uploadFile(files[0])
      .then(({ src }) => update({ [key]: src }))
      .catch((err: Error) => onError(err.message));
  const isUrl = /^https?:/.test(node.data.src);
  return (
    <>
      <Field label="YouTube or Vimeo URL">
        <input
          value={isUrl ? node.data.src : ''}
          placeholder="https://youtu.be/…"
          onChange={(e) => update({ src: e.target.value })}
        />
      </Field>
      <div className={styles.row}>
        <UploadButton label="Upload video" accept="video/*" onFiles={upload('src')} />
        <UploadButton label="Poster" accept="image/*" onFiles={upload('poster')} />
      </div>
    </>
  );
}

function DemoFields({
  node,
  onError,
}: {
  node: Extract<FlowNode, { type: 'demo' }>;
  onError: OnError;
}) {
  const update = useUpdate<'demo'>(node.id);
  const replace = (files: File[]) =>
    uploadDemo(files)
      .then(({ demoId, entry }) => update({ demoId, entry }))
      .catch((err: Error) => onError(err.message));
  const ready = node.data.demoId !== 'pending';
  return (
    <>
      <Field label="Title">
        <input value={node.data.title} onChange={(e) => update({ title: e.target.value })} />
      </Field>
      <Field label="Device width">
        <select
          value={node.data.device}
          onChange={(e) => update({ device: e.target.value as keyof typeof DEVICES })}
        >
          {Object.entries(DEVICES).map(([device, width]) => (
            <option key={device} value={device}>
              {device} ({width}px)
            </option>
          ))}
        </select>
      </Field>
      <div className={styles.row}>
        <UploadButton
          label={ready ? 'Replace files' : 'Upload files'}
          accept=".html,.htm,.css,.js,.mjs,.json,image/*"
          multiple
          onFiles={replace}
        />
        <UploadButton label="Folder" folder onFiles={replace} />
      </div>
      <UploadButton
        label={node.data.poster ? 'Replace poster' : 'Poster image'}
        accept="image/*"
        onFiles={([file]) =>
          uploadFile(file)
            .then(({ src }) => update({ poster: src }))
            .catch((err: Error) => onError(err.message))
        }
      />
      <p className={styles.hint}>
        The poster shows when zoomed out. Drag the demo by its title bar.
        {ready && (
          <>
            {' '}
            <a
              href={asset(`content/demos/${node.data.demoId}/${node.data.entry}`)}
              target="_blank"
              rel="noreferrer"
            >
              Open in a new tab
            </a>
          </>
        )}
      </p>
    </>
  );
}

function EdgeFields({ edge }: { edge: FlowEdge }) {
  const updateEdge = useMapStore((s) => s.updateEdge);
  return (
    <>
      <h2 className={styles.inspectorTitle}>Connector</h2>
      <Field label="Label">
        <input
          value={typeof edge.label === 'string' ? edge.label : ''}
          onChange={(e) => updateEdge(edge.id, { label: e.target.value })}
        />
      </Field>
      <Field label="Style">
        <select
          value={edge.type ?? 'smoothstep'}
          onChange={(e) => updateEdge(edge.id, { type: e.target.value as FlowEdge['type'] })}
        >
          <option value="smoothstep">Elbow</option>
          <option value="default">Curve</option>
          <option value="straight">Straight</option>
        </select>
      </Field>
      <label className={`${styles.field} ${styles.check}`}>
        <input
          type="checkbox"
          checked={!!edge.animated}
          onChange={(e) => updateEdge(edge.id, { animated: e.target.checked })}
        />
        Animated
      </label>
      <ConnectorLook edge={edge} />
    </>
  );
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const DEFAULT_CONNECTOR_COLOR = tokenValues['component.connector.color'];
const DEFAULT_CONNECTOR_WIDTH = Number.parseFloat(tokenValues['component.connector.width']);

/** Color (picker + hex) and thickness for one connector, with a way back to the defaults. */
function ConnectorLook({ edge }: { edge: FlowEdge }) {
  const updateEdge = useMapStore((s) => s.updateEdge);
  const color = edge.color ?? DEFAULT_CONNECTOR_COLOR;
  const width = edge.width ?? DEFAULT_CONNECTOR_WIDTH;
  // The hex field keeps what you type until it's a full #rrggbb.
  const [hex, setHex] = useState(color);
  useEffect(() => setHex(color), [color]);

  return (
    <>
      <Field label="Color">
        <div className={styles.sizeRow}>
          <input
            type="color"
            className={styles.colorSwatch}
            value={color}
            aria-label="Color picker"
            onChange={(e) => updateEdge(edge.id, { color: e.target.value })}
          />
          <input
            value={hex}
            spellCheck={false}
            aria-label="Hex color"
            placeholder="#rrggbb"
            onChange={(e) => {
              const value = e.target.value.trim();
              setHex(value);
              const full = value.startsWith('#') ? value : `#${value}`;
              if (HEX.test(full)) updateEdge(edge.id, { color: full.toLowerCase() });
            }}
          />
        </div>
      </Field>
      <Field label="Thickness (px)">
        <div className={styles.sizeRow}>
          <input
            type="range"
            min={0.5}
            max={12}
            step={0.5}
            value={width}
            aria-label="Thickness slider"
            onChange={(e) => updateEdge(edge.id, { width: Number(e.target.value) })}
          />
          <input
            type="number"
            min={0.5}
            max={12}
            step={0.5}
            value={width}
            aria-label="Thickness"
            onChange={(e) => {
              const value = Number(e.target.value);
              if (value >= 0.5 && value <= 12) updateEdge(edge.id, { width: value });
            }}
          />
        </div>
      </Field>
      {(edge.color || edge.width) && (
        <div className={styles.actions}>
          <Button onClick={() => updateEdge(edge.id, { color: undefined, width: undefined })}>
            Use default look
          </Button>
        </div>
      )}
    </>
  );
}

const TITLES: Record<NodeType, string> = {
  note: 'Note',
  text: 'Text',
  label: 'Label',
  code: 'Code',
  stack: 'Stack',
  shape: 'Shape',
  image: 'Image',
  video: 'Video',
  demo: 'Demo',
};

function NodeFields({ node, onError }: { node: FlowNode; onError: OnError }) {
  switch (node.type) {
    case 'note':
      return <NoteFields node={node} />;
    case 'label':
      return <LabelFields node={node} />;
    case 'text':
      return <TextFields node={node} />;
    case 'code':
      return <CodeFields node={node} />;
    case 'stack':
      return <StackFields node={node} />;
    case 'shape':
      return <ShapeFields node={node} />;
    case 'image':
      return <ImageFields node={node} onError={onError} />;
    case 'video':
      return <VideoFields node={node} onError={onError} />;
    case 'demo':
      return <DemoFields node={node} onError={onError} />;
  }
}

function setZIndex(id: string, edge: 'front' | 'back') {
  const { nodes } = useMapStore.getState();
  const zs = nodes.map((n) => n.zIndex ?? 0);
  const zIndex = edge === 'front' ? Math.max(...zs) + 1 : Math.min(...zs) - 1;
  useMapStore.setState({ nodes: nodes.map((n) => (n.id === id ? { ...n, zIndex } : n)) });
}

/** Properties of the single selected node or edge. */
export function Inspector({ onError }: { onError: OnError }) {
  const nodes = useMapStore(useShallow((s) => s.nodes.filter((n) => n.selected)));
  const edges = useMapStore(useShallow((s) => s.edges.filter((e) => e.selected)));
  const { deleteElements } = useReactFlow();

  if (nodes.length + edges.length !== 1) return null;
  const node = nodes[0];

  const remove = () => deleteElements({ nodes: [{ id: node.id }] });

  return (
    <aside className={`${styles.panel} ${styles.inspector}`} aria-label="Inspector">
      {node ? (
        <>
          <h2 className={styles.inspectorTitle}>{TITLES[node.type]}</h2>
          <NodeFields node={node} onError={onError} />
          <div className={styles.actions}>
            <Button onClick={() => setZIndex(node.id, 'front')}>Bring to front</Button>
            <Button onClick={() => setZIndex(node.id, 'back')}>Send to back</Button>
            <Button variant="danger" onClick={remove}>
              Delete
            </Button>
          </div>
        </>
      ) : (
        <EdgeFields edge={edges[0]} />
      )}
    </aside>
  );
}
