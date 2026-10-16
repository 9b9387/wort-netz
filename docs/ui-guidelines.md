# WortNetz UI 规范

本文档是 WortNetz 前端界面的统一设计与实现标准。新增或修改页面、组件时，必须先遵循本规范。

## 1. 技术基线

- UI 组件：shadcn/ui v4，Base UI（`@base-ui/react`），style 为 `base-nova`
- 样式：Tailwind CSS v4，主题变量统一维护在 `app/globals.css`
- 图标：`lucide-react`
- 工具函数：`cn` 从 `@/lib/utils` 导入
- 组件目录：`components/ui`

新增组件统一使用：

```bash
./node_modules/.bin/shadcn add <component>
```

禁止手写可被现有 shadcn 组件替代的自定义 `div`、按钮、卡片或徽章样式。

## 2. 设计令牌

颜色、圆角、字体和阴影一律使用语义令牌，不写原始颜色值。

### 2.1 颜色

| 用途 | Token |
| --- | --- |
| 页面背景 | `bg-background` / `text-foreground` |
| 卡片背景 | `bg-card` / `text-card-foreground` |
| 主按钮 / 强调色 | `bg-primary` / `text-primary-foreground` |
| 次级内容 | `bg-secondary` / `text-secondary-foreground` |
| 柔和背景 | `bg-muted` |
| 次要文字 | `text-muted-foreground` |
| 边框 | `border-border` |
| 输入框边框 | `border-input` |
| 焦点环 | `ring-ring` |
| 错误 / 危险 | `text-destructive`、`variant="destructive"` |
| 阳性名词 `der` | `bg-gender-masculine-muted` / `text-gender-masculine-foreground` |
| 阴性名词 `die` | `bg-gender-feminine-muted` / `text-gender-feminine-foreground` |
| 中性名词 `das` | `bg-gender-neuter-muted` / `text-gender-neuter-foreground` |
| 复数形式 | `bg-gender-plural-muted` / `text-gender-plural-foreground` |
| CEFR 级别 | `bg-cefr-muted` / `text-cefr-foreground` |

禁止：

```tsx
<span className="text-emerald-600">成功</span>
<div className="bg-zinc-50 text-zinc-950">内容</div>
```

允许：

```tsx
<Badge variant="secondary">状态</Badge>
<p className="text-muted-foreground">说明文字</p>
```

### 2.2 圆角与间距

- 圆角统一使用 `rounded-lg` / `rounded-xl`，组件默认圆角由 `--radius` 控制。
- 不使用 `space-x-*` 或 `space-y-*`，统一使用 `flex` + `gap-*`。
- 等宽高元素使用 `size-*`，例如 `size-8`、`size-10`。
- 长文本截断使用 `truncate`。

## 3. 布局

应用外壳使用 shadcn `Sidebar`，而不是手写侧边栏。

结构：

```tsx
<SidebarProvider>
  <Sidebar collapsible="icon">
    <SidebarHeader>品牌区</SidebarHeader>
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>导航分组</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton render={<Link href="/" />} isActive>
                <HomeIcon />
                <span>首页</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
    <SidebarRail />
  </Sidebar>

  <SidebarInset>
    <header>
      <SidebarTrigger />
    </header>
    <main>{children}</main>
  </SidebarInset>
</SidebarProvider>
```

内容区块优先使用 `Card` 完整结构：

```tsx
<Card>
  <CardHeader>
    <CardTitle>标题</CardTitle>
    <CardDescription>说明</CardDescription>
  </CardHeader>
  <CardContent>主体内容</CardContent>
  <CardFooter>操作区</CardFooter>
</Card>
```

## 4. 表单

### 4.1 表单结构

所有表单字段必须使用 `FieldGroup` + `Field` + `FieldLabel`：

```tsx
<FieldGroup>
  <Field>
    <FieldLabel htmlFor="email">邮箱</FieldLabel>
    <Input id="email" name="email" type="email" />
  </Field>
  <Field>
    <FieldLabel htmlFor="password">密码</FieldLabel>
    <Input id="password" name="password" type="password" />
  </Field>
</FieldGroup>
```

### 4.2 控件选择

| 场景 | 组件 |
| --- | --- |
| 单行文本 | `Input` |
| 多行文本 | `Textarea` |
| 布尔开关 | `Switch` |
| 多选 | `Checkbox` |
| 2-7 个选项单选/切换 | `ToggleGroup` |
| 下拉选择 | `Select` |
| 可搜索选择 | `Combobox` |
| 按钮提交 | `Button type="submit"` |

### 4.3 校验与禁用状态

`Field` 使用 `data-invalid` / `data-disabled`，控件使用 `aria-invalid` / `disabled`：

```tsx
<Field data-invalid>
  <FieldLabel htmlFor="email">邮箱</FieldLabel>
  <Input id="email" aria-invalid />
  <FieldError>邮箱格式不正确。</FieldError>
</Field>
```

### 4.4 加载状态

按钮加载态不使用自定义 `isLoading`，使用 `Spinner` + `data-icon` + `disabled`：

```tsx
<Button type="submit" disabled={pending}>
  <Spinner data-icon="inline-start" />
  处理中…
</Button>
```

## 5. 反馈与状态

- 提示信息使用 `Alert`。
- 空状态使用 `Empty` 系列组件。
- 加载占位使用 `Skeleton`。
- 分隔线使用 `Separator`。
- 小型状态或标签使用 `Badge`。
- 对话框使用 `Dialog`；侧边面板使用 `Sheet`；确认危险操作使用 `AlertDialog`。

## 6. 图标

- 只从 `lucide-react` 导入。
- 图标放入 `Button` 时使用 `data-icon="inline-start"` 或 `data-icon="inline-end"`。
- 图标在组件内不添加尺寸类，组件负责统一尺寸。
- 不要把图标名作为字符串查找，直接传组件：

```tsx
<Button>
  <SearchIcon data-icon="inline-start" />
  搜索
</Button>
```

## 7. 禁止清单

- 不写原始 Tailwind 颜色，如 `bg-blue-500`、`text-zinc-600`。
- 不使用 `space-x-*` / `space-y-*`。
- 不使用 `w-* h-*` 表达等宽高，改用 `size-*`。
- 不手写 `animate-pulse` 骨架，使用 `Skeleton`。
- 不手写 `<hr>` 或 `border-t` 分隔线，使用 `Separator`。
- 不手写空状态提示框，使用 `Empty`。
- 不在 overlay 组件上手动设置 `z-index`。
- 不在组件上覆盖颜色或字体，除非通过语义令牌或 CSS 变量。

## 8. 验收清单

- [ ] 页面使用 shadcn 组件，未出现可替代的自定义 UI。
- [ ] 颜色全部使用语义令牌。
- [ ] 表单使用 `FieldGroup` + `Field`，校验与禁用属性完整。
- [ ] 图标使用 `lucide-react` 并正确标记 `data-icon`。
- [ ] 空状态、加载状态、反馈状态均使用对应组件。
- [ ] `npm run lint` 与 `npm run typecheck` 均通过。
