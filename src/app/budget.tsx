import { useRouter } from "expo-router";

import { BudgetCard } from "../components/BudgetCard";
import { Heading, IconButton, Page, Row } from "../components/ui";
import { useUi } from "../state/ui";

export default function Budget() {
  const router = useRouter();

  const month = useUi((s) => s.month);
  return (
    <Page>
      <Row>
        <IconButton
          name="chevron.left"
          label="返回"
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/(tabs)")
          }
        />
        <Heading title="预算" />
      </Row>


      <BudgetCard key={month} month={month} editable />
    </Page>
  );
}
