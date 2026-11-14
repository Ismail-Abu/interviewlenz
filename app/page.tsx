import { ProblemRoom } from "@/components/ProblemRoom";
import { containsDuplicate } from "@/lib/problems";

export default function Home() {
  return <ProblemRoom problem={containsDuplicate} />;
}
