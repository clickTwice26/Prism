"use client";

import { useState } from "react";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { SignLanguageCIcon, StudentIcon, TeacherIcon } from "@hugeicons/core-free-icons";
import { Icon } from "@/components/Icon";
import { InterpreterView } from "./InterpreterView";
import { StudentView } from "./StudentView";

type Role = "student" | "teacher" | "interpreter";
import { TeacherView } from "./TeacherView";

export function LiveClass() {
  const [role, setRole] = useState<Role>("student");
  return (
    <Stack spacing={3}>
      <ToggleButtonGroup
        exclusive
        aria-label="I am a"
        value={role}
        onChange={(_, v: Role | null) => v && setRole(v)}
        sx={{ alignSelf: "flex-start", flexWrap: "wrap" }}
      >
        <ToggleButton value="student" sx={{ gap: 1, px: 2.5 }}>
          <Icon icon={StudentIcon} size={20} /> I&apos;m a student
        </ToggleButton>
        <ToggleButton value="teacher" sx={{ gap: 1, px: 2.5 }}>
          <Icon icon={TeacherIcon} size={20} /> I&apos;m the teacher
        </ToggleButton>
        <ToggleButton value="interpreter" sx={{ gap: 1, px: 2.5 }}>
          <Icon icon={SignLanguageCIcon} size={20} /> I&apos;m the sign interpreter
        </ToggleButton>
      </ToggleButtonGroup>
      {role === "student" ? <StudentView /> : role === "teacher" ? <TeacherView /> : <InterpreterView />}
    </Stack>
  );
}
