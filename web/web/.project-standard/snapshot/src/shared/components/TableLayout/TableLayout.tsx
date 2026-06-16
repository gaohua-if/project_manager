import { DatePicker, Input, Select, Skeleton } from "antd";
import type { ComponentProps, PropsWithChildren, ReactNode } from "react";

import "./TableLayout.css";

type SearchInputProps = ComponentProps<typeof Input.Search> & TableLayoutFilterItemProps;
type TextFilterProps = ComponentProps<typeof Input> & TableLayoutFilterItemProps;
type SelectFilterProps = ComponentProps<typeof Select> & TableLayoutFilterItemProps;
type DateRangeFilterProps = ComponentProps<typeof DatePicker.RangePicker> &
  TableLayoutFilterItemProps;

interface TableLayoutProps extends PropsWithChildren {
  operations?: ReactNode;
  search?: ReactNode;
  switchBox?: ReactNode;
  loading?: boolean;
  searchAlign?: "left" | "right";
}

type TableLayoutComponent = ((props: TableLayoutProps) => React.ReactElement) & {
  SearchGroup: typeof SearchGroup;
  SearchItem: typeof SearchItem;
  SelectItem: typeof SelectItem;
  SearchInput: typeof SearchInput;
  TextFilter: typeof TextFilter;
  SelectFilter: typeof SelectFilter;
  DateRangeFilter: typeof DateRangeFilter;
};

function TableLayoutRoot({
  operations,
  search,
  switchBox,
  loading = false,
  searchAlign = "right",
  children
}: TableLayoutProps) {
  return (
    <section className="table-layout">
      {(operations || search || switchBox) && (
        <div className={`table-layout__toolbar table-layout__toolbar--${searchAlign}`}>
          <div className="table-layout__operations">{operations}</div>
          <div className="table-layout__search">{search}</div>
          {switchBox && <div className="table-layout__switch">{switchBox}</div>}
        </div>
      )}
      <div className="table-layout__body">
        {loading ? <Skeleton active paragraph={{ rows: 8 }} /> : children}
      </div>
    </section>
  );
}

/**
 * Groups list-page filters under the shared toolbar layout.
 * Prefer the typed filter helpers below before using raw AntD controls.
 */
function SearchGroup({ children }: PropsWithChildren) {
  return <div className="table-layout__search-group">{children}</div>;
}

interface TableLayoutItemProps extends PropsWithChildren {
  size?: "sm" | "md" | "lg";
  grow?: boolean;
}

interface TableLayoutFilterItemProps {
  itemSize?: TableLayoutItemProps["size"];
  itemGrow?: boolean;
}

function SearchItem({ children, size = "md", grow = false }: TableLayoutItemProps) {
  return (
    <div
      className={[
        "table-layout__search-item",
        `table-layout__search-item--${size}`,
        grow ? "is-grow" : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

function SelectItem({ children, size = "md", grow = false }: TableLayoutItemProps) {
  return (
    <div
      className={[
        "table-layout__select-item",
        `table-layout__select-item--${size}`,
        grow ? "is-grow" : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

function SearchInput({ itemSize = "lg", itemGrow = false, ...props }: SearchInputProps) {
  return (
    <SearchItem size={itemSize} grow={itemGrow}>
      <Input.Search allowClear {...props} />
    </SearchItem>
  );
}

function TextFilter({ itemSize = "md", itemGrow = false, ...props }: TextFilterProps) {
  return (
    <SearchItem size={itemSize} grow={itemGrow}>
      <Input allowClear {...props} />
    </SearchItem>
  );
}

function SelectFilter({ itemSize = "md", itemGrow = false, ...props }: SelectFilterProps) {
  return (
    <SelectItem size={itemSize} grow={itemGrow}>
      <Select allowClear {...props} />
    </SelectItem>
  );
}

function DateRangeFilter({ itemSize = "md", itemGrow = false, ...props }: DateRangeFilterProps) {
  return (
    <SearchItem size={itemSize} grow={itemGrow}>
      <DatePicker.RangePicker {...props} />
    </SearchItem>
  );
}

export const TableLayout = TableLayoutRoot as TableLayoutComponent;

TableLayout.SearchGroup = SearchGroup;
TableLayout.SearchItem = SearchItem;
TableLayout.SelectItem = SelectItem;
TableLayout.SearchInput = SearchInput;
TableLayout.TextFilter = TextFilter;
TableLayout.SelectFilter = SelectFilter;
TableLayout.DateRangeFilter = DateRangeFilter;
