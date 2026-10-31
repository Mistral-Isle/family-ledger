import { zh } from "../i18n/zh";
import { assertMoney } from "../domain/money";
import { useState } from "react";
import { Modal, View } from "react-native";
import { useLedger } from "./LedgerProvider";
import {
  Button,
  Card,
  Chip,
  ErrorText,
  Field,
  Heading,
  IconButton,
  Page,
  Txt,
  styles,
  useTheme,
} from "./ui";
import {
  categoryDeletionImpact,
  type CategoryDeletion,
} from "../domain/categoryDeletion";
import { totals } from "../domain/selectors";
import { formatMoney } from "../domain/money";
import { useReducedMotion } from "./useReducedMotion";

export function CategoryDeletionSheet({
  id,
  initialTargetId,
  onClose,
}: {
  id: string;
  initialTargetId?: string;
  onClose: () => void;
}) {
  const { data, repo, run } = useLedger();
  const theme = useTheme();
  const reduced = useReducedMotion();
  const [action, setAction] = useState<CategoryDeletion["action"]>("migrate");
  const [targetId, setTargetId] = useState(initialTargetId ?? "");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const rawImpact = categoryDeletionImpact(data, id);
  const impact = {
    ...rawImpact,
    txns: rawImpact.txns.filter((t) => t.scope === "family"),
  };
  const ids = new Set(impact.categories.map((c) => c.id));
  const targets = data.categories.filter(
    (c) => !c.deleted && c.kind === impact.source.kind && !ids.has(c.id),
  );
  const affected = totals(impact.txns);
  return (
    <Modal
      visible
      onRequestClose={onClose}
      animationType={reduced ? "fade" : "slide"}
      presentationStyle="pageSheet"
    >
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <Page modal>
          <Heading
            title={`删除「${impact.source.name}」`}
            action={
              <IconButton name="xmark" label="取消删除" onPress={onClose} />
            }
          />
          <Card>
            <Txt bold>影响预览</Txt>
            <Txt>
              {impact.categories.length} 个分类（含子分类），
              {impact.txns.length} 笔流水
            </Txt>
            <Txt>{impact.categories.map((c) => c.name).join("、")}</Txt>
            <Txt>
              {zh.discarded.amount} ·{" "}
              {formatMoney(
                impact.txns.reduce((sum, t) => assertMoney(sum + t.amount), 0),
              )}
            </Txt>
            <Txt>
              {zh.discarded.months} ·{" "}
              {[...new Set(impact.txns.map((t) => t.occurredAt.slice(0, 7)))]
                .sort()
                .join("、") || "—"}
            </Txt>
            <Txt>当前及历史账户余额均不变。</Txt>
            <Txt size={12} color={theme.muted}>
              {impact.favorites.length}{" "}
              个相关常用项会迁移到接收分类，选择丢弃则移除。恢复时仅还原未被后续修改的常用项。
            </Txt>
          </Card>
          <View style={styles.wrap}>
            <Chip
              label="迁移到已有分类"
              selected={action === "migrate"}
              onPress={() => setAction("migrate")}
            />
            <Chip
              label="新建分类接收"
              selected={action === "create"}
              onPress={() => setAction("create")}
            />
            <Chip
              label="丢弃流水"
              selected={action === "discard"}
              onPress={() => setAction("discard")}
            />
          </View>
          {action === "migrate" && (
            <>
              <Txt>选择同类型接收分类</Txt>
              <View style={styles.wrap}>
                {targets.map((c) => (
                  <Chip
                    key={c.id}
                    label={[
                      data.categories.find((p) => p.id === c.parentId)?.name,
                      c.name,
                    ]
                      .filter(Boolean)
                      .join(" / ")}
                    selected={targetId === c.id}
                    onPress={() => setTargetId(c.id)}
                  />
                ))}
              </View>
              {!targets.length && (
                <Txt>没有可接收的分类，请选择新建分类接收。</Txt>
              )}
            </>
          )}
          {action === "create" && (
            <Field
              label="新一级分类名称"
              value={name}
              onChangeText={setName}
              maxLength={30}
            />
          )}
          <Card>
            <Txt>
              {action === "discard"
                ? "相关流水整笔退出明细和统计，包含关联退款及其中的超额收入。账户余额仍保留实际收付。"
                : "所有子分类的历史流水合并到接收分类；退款关联与金额拆分保持不变。"}
            </Txt>
            {action === "discard" && (
              <Txt>
                家庭统计将移除：支出 {formatMoney(affected.expense)}，收入{" "}
                {formatMoney(affected.income)}（含退款抵减）。
              </Txt>
            )}
            <Txt size={12} color={theme.muted}>
              可在分类管理底部恢复。相关流水或分类后续有修改时，将阻止恢复以避免覆盖新数据。新建的接收分类会保留。
            </Txt>
          </Card>
          <ErrorText message={error} />
          <Button
            label="确认删除分类"
            onPress={() => {
              try {
                const choice: CategoryDeletion =
                  action === "migrate"
                    ? { action, targetId }
                    : action === "create"
                      ? { action, name }
                      : { action };
                run(() => repo.deleteCategory(id, choice));
                onClose();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          />
          <Button secondary label="取消" onPress={onClose} />
        </Page>
      </View>
    </Modal>
  );
}
