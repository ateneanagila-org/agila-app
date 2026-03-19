"use client";
import { getSheetData, uploadSheetData } from "@/app/actions/gsheets";
import { Button } from "@/components/ui/button";

export default function Page() {
  const handleOnGetSheetDataClick = async () => {
    const response = await getSheetData();
    console.log(response);
  };

  const handleOnUploadSheetDataClick = async () => {
    const response = await uploadSheetData();
    console.log(response);
  };

  return (
    <>
      <Button onClick={handleOnGetSheetDataClick}>Get Sheet Data</Button>
      <Button onClick={handleOnUploadSheetDataClick}>Upload Sheet Data</Button>
    </>
  );
}
