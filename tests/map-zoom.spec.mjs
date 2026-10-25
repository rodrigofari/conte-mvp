import { test, expect } from "@playwright/test";

test("amplia o satélite sem pedir tiles acima da cobertura disponível", async ({
  page,
}) => {
  const tileLevels = [];
  page.on("request", (request) => {
    const match = request
      .url()
      .match(/World_Imagery\/MapServer\/tile\/(\d+)\//);
    if (match) tileLevels.push(Number(match[1]));
  });
  await page.goto("http://localhost:5175");
  await page.getByRole("button", { name: "Explorações", exact: true }).click();
  await page
    .getByRole("button", { name: "Ver exploração", exact: true })
    .nth(2)
    .click();
  await page
    .getByRole("button", { name: "Editar no mapa", exact: true })
    .click();
  await page.waitForTimeout(1500);
  for (let i = 0; i < 4; i++) {
    await page
      .getByRole("button", { name: "Aumentar zoom", exact: true })
      .click();
    await page.waitForTimeout(400);
  }
  await expect(
    page.getByText("Imagem de satélite ampliada · resolução máxima disponível"),
  ).toBeVisible();
  await page.waitForTimeout(1200);
  expect(tileLevels).toContain(18);
  expect(Math.max(...tileLevels)).toBe(18);
  await page.screenshot({
    path: ".context/satellite-high-zoom.png",
    fullPage: true,
  });
});
