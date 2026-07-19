import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BriefcaseBusiness, Check, ChevronLeft, Copy, Folder, GripVertical, MoreHorizontal, Pencil, Plus, Star, Trash2 } from "lucide-react";
import type { Page } from "../../domain/models";
import { IconButton } from "../../components/IconButton";
import { Logo } from "../../components/Logo";

interface PageSidebarProps {
  pages: Page[];
  activePageId: string;
  expanded: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onRename: (page: Page) => void;
  onDuplicate: (page: Page) => void;
  onDelete: (page: Page) => void;
  onSetDefault: (page: Page) => void;
  onMove: (id: string, targetIndex: number) => void;
  onToggleExpanded: () => void;
}

interface PageRowProps {
  page: Page;
  active: boolean;
  expanded: boolean;
  onSelect: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
}

function PageRow({ page, active, expanded, onSelect, onRename, onDuplicate, onDelete, onSetDefault }: PageRowProps) {
  const sortable = useSortable({ id: page.id, data: { type: "page" } });
  const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition };
  return (
    <div ref={sortable.setNodeRef} style={style} className={`page-row ${active ? "is-active" : ""} ${sortable.isDragging ? "is-dragging" : ""}`}>
      <button className="page-row__main" onClick={onSelect} aria-current={active ? "page" : undefined} title={page.title}>
        <Folder size={19} aria-hidden="true" />
        {expanded ? <span>{page.title}</span> : null}
        {expanded && page.isDefault ? <Star size={13} className="page-row__default" aria-label="Default page" /> : null}
      </button>
      {expanded ? (
        <>
          <button className="drag-handle" aria-label={`Reorder ${page.title}`} {...sortable.attributes} {...sortable.listeners}><GripVertical size={15} /></button>
          <details className="menu page-row__menu">
            <summary aria-label={`Actions for ${page.title}`}><MoreHorizontal size={16} /></summary>
            <div className="menu__popover">
              <button onClick={onRename}><Pencil size={15} />Rename</button>
              <button onClick={onDuplicate}><Copy size={15} />Duplicate</button>
              <button onClick={onSetDefault}>{page.isDefault ? <Check size={15} /> : <Star size={15} />}Set as default</button>
              <button className="danger" onClick={onDelete}><Trash2 size={15} />Move to Trash</button>
            </div>
          </details>
        </>
      ) : null}
    </div>
  );
}

export function PageSidebar(props: PageSidebarProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (event: DragEndEvent): void => {
    if (!event.over || event.active.id === event.over.id) return;
    const targetIndex = props.pages.findIndex((page) => page.id === event.over?.id);
    if (targetIndex >= 0) props.onMove(String(event.active.id), targetIndex);
  };
  return (
    <aside className={`sidebar ${props.expanded ? "sidebar--expanded" : "sidebar--rail"}`}>
      <div className="sidebar__brand"><Logo compact={!props.expanded} /></div>
      {props.expanded ? <div className="sidebar__label">Pages</div> : null}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={props.pages.map((page) => page.id)} strategy={verticalListSortingStrategy}>
          <nav className="page-list" aria-label="Pages">
            {props.pages.map((page) => (
              <PageRow
                key={page.id}
                page={page}
                active={page.id === props.activePageId}
                expanded={props.expanded}
                onSelect={() => props.onSelect(page.id)}
                onRename={() => props.onRename(page)}
                onDuplicate={() => props.onDuplicate(page)}
                onDelete={() => props.onDelete(page)}
                onSetDefault={() => props.onSetDefault(page)}
              />
            ))}
          </nav>
        </SortableContext>
      </DndContext>
      <button className="sidebar__add" onClick={props.onCreate} title="Add page"><Plus size={18} />{props.expanded ? <span>Add page</span> : null}</button>
      <div className="sidebar__spacer" />
      {props.expanded ? (
        <div className="sidebar__tip"><BriefcaseBusiness size={16} /><span>Everything is stored locally</span></div>
      ) : null}
      <IconButton label={props.expanded ? "Collapse sidebar" : "Expand sidebar"} className="sidebar__collapse" onClick={props.onToggleExpanded}>
        <ChevronLeft size={18} className={props.expanded ? "" : "rotate-180"} />
      </IconButton>
    </aside>
  );
}
