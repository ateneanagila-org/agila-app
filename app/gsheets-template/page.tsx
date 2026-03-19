"use client";
import { getSheetData } from "@/app/actions/googlesheets";
import { Button } from "@/components/ui/button";

export default function Page() {
  const handleOnGetSheetDataClick = async () => {
    const response = await getSheetData();
    console.log(response);
  };

  return <Button onClick={handleOnGetSheetDataClick}>Get Sheet Data</Button>;
}
