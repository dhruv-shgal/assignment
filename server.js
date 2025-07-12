const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage for tasks
let tasks = [];
let nextTaskId = 1;

// Rule-based AI patterns
const taskPatterns = {
  create: [
    /(?:add|create|make|new)\s+(?:a\s+)?task\s+(?:to\s+)?(.+?)(?:\s+by\s+(.+?))?$/i,
    /(?:i\s+need\s+to|i\s+have\s+to|i\s+should)\s+(.+?)(?:\s+by\s+(.+?))?$/i,
    /(?:remind\s+me\s+to|remember\s+to)\s+(.+?)(?:\s+by\s+(.+?))?$/i,
  ],
  list: [
    /(?:show|list|display|what\s+are)\s+(?:my\s+)?tasks?/i,
    /(?:what\s+do\s+i\s+have|what\s+are\s+my\s+tasks?)/i,
    /(?:tasks?\s+for\s+(.+?))/i,
    /(?:show\s+me\s+(.+?)\s+tasks?)/i,
  ],
  update: [
    /(?:mark|set|update)\s+task\s+(\d+)\s+(?:as\s+)?(.+?)$/i,
    /(?:complete|finish|done\s+with)\s+task\s+(\d+)/i,
    /(?:task\s+(\d+)\s+is\s+(.+?))/i,
  ],
  delete: [
    /(?:delete|remove|cancel)\s+task\s+(\d+)/i,
    /(?:delete|remove)\s+(?:the\s+)?(.+?)\s+task/i,
  ],
};

// Helper function to generate current date
const getCurrentDate = () => {
  return new Date().toISOString().split("T")[0];
};

// Helper function to parse date from natural language
const parseDate = (dateString) => {
  const today = new Date();
  const dateStr = dateString.toLowerCase();

  if (dateStr.includes("today")) {
    return today.toISOString().split("T")[0];
  }

  if (dateStr.includes("tomorrow")) {
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  }

  if (dateStr.includes("friday")) {
    const friday = new Date(today);
    const daysUntilFriday = (5 - today.getDay() + 7) % 7;
    friday.setDate(today.getDate() + daysUntilFriday);
    return friday.toISOString().split("T")[0];
  }

  if (dateStr.includes("monday")) {
    const monday = new Date(today);
    const daysUntilMonday = (1 - today.getDay() + 7) % 7;
    monday.setDate(today.getDate() + daysUntilMonday);
    return monday.toISOString().split("T")[0];
  }

  // Try to parse as regular date
  const parsed = new Date(dateString);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }

  return getCurrentDate();
};

// Task CRUD APIs
app.post("/tasks", (req, res) => {
  const { title, dueDate, status = "Not Started", description = "" } = req.body;

  if (!title) {
    return res.status(400).json({ error: "Title is required" });
  }

  const newTask = {
    id: nextTaskId++,
    title,
    description,
    dueDate: dueDate || getCurrentDate(),
    status,
    createdAt: new Date().toISOString(),
  };

  tasks.push(newTask);
  res.status(201).json(newTask);
});

app.get("/tasks", (req, res) => {
  const { status, dueDate } = req.query;
  let filteredTasks = tasks;

  if (status) {
    filteredTasks = filteredTasks.filter(
      (task) => task.status.toLowerCase() === status.toLowerCase()
    );
  }

  if (dueDate) {
    filteredTasks = filteredTasks.filter((task) => task.dueDate === dueDate);
  }

  res.json(filteredTasks);
});

app.put("/tasks/:id", (req, res) => {
  const taskId = parseInt(req.params.id);
  const taskIndex = tasks.findIndex((task) => task.id === taskId);

  if (taskIndex === -1) {
    return res.status(404).json({ error: "Task not found" });
  }

  const { title, description, dueDate, status } = req.body;

  if (title) tasks[taskIndex].title = title;
  if (description !== undefined) tasks[taskIndex].description = description;
  if (dueDate) tasks[taskIndex].dueDate = dueDate;
  if (status) tasks[taskIndex].status = status;

  res.json(tasks[taskIndex]);
});

app.delete("/tasks/:id", (req, res) => {
  const taskId = parseInt(req.params.id);
  const taskIndex = tasks.findIndex((task) => task.id === taskId);

  if (taskIndex === -1) {
    return res.status(404).json({ error: "Task not found" });
  }

  const deletedTask = tasks.splice(taskIndex, 1)[0];
  res.json({ message: "Task deleted successfully", task: deletedTask });
});

// Rule-based AI Agent endpoint
app.post("/ai-agent", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Parse user message using rule-based patterns
    const parsedResponse = parseUserMessage(message.toLowerCase().trim());

    if (!parsedResponse) {
      return res.json({
        success: false,
        message:
          'I didn\'t understand that. Try commands like: "add task to buy groceries", "show my tasks", "mark task 1 as completed", or "delete task 2"',
      });
    }

    // Execute the action
    let result;
    switch (parsedResponse.action) {
      case "createTask":
        const taskData = parsedResponse.data;
        if (taskData.dueDate) {
          taskData.dueDate = parseDate(taskData.dueDate);
        }
        const newTask = {
          id: nextTaskId++,
          title: taskData.title,
          description: taskData.description || "",
          dueDate: taskData.dueDate || getCurrentDate(),
          status: taskData.status || "Not Started",
          createdAt: new Date().toISOString(),
        };
        tasks.push(newTask);
        result = {
          success: true,
          message: `Task "${newTask.title}" created successfully!`,
          task: newTask,
        };
        break;

      case "listTasks":
        const filterData = parsedResponse.data || {};
        let filteredTasks = tasks;

        if (filterData.status) {
          filteredTasks = filteredTasks.filter(
            (task) =>
              task.status.toLowerCase() === filterData.status.toLowerCase()
          );
        }

        if (filterData.dueDate) {
          filteredTasks = filteredTasks.filter(
            (task) => task.dueDate === filterData.dueDate
          );
        }

        result = {
          success: true,
          message: `Found ${filteredTasks.length} task(s)`,
          tasks: filteredTasks,
        };
        break;

      case "updateTask":
        const updateData = parsedResponse.data;
        const taskIndex = tasks.findIndex((task) => task.id === updateData.id);

        if (taskIndex === -1) {
          result = {
            success: false,
            message: "Task not found",
          };
        } else {
          if (updateData.title) tasks[taskIndex].title = updateData.title;
          if (updateData.description !== undefined)
            tasks[taskIndex].description = updateData.description;
          if (updateData.dueDate)
            tasks[taskIndex].dueDate = parseDate(updateData.dueDate);
          if (updateData.status) tasks[taskIndex].status = updateData.status;

          result = {
            success: true,
            message: `Task "${tasks[taskIndex].title}" updated successfully!`,
            task: tasks[taskIndex],
          };
        }
        break;

      case "deleteTask":
        const deleteData = parsedResponse.data;
        const deleteIndex = tasks.findIndex(
          (task) => task.id === deleteData.id
        );

        if (deleteIndex === -1) {
          result = {
            success: false,
            message: "Task not found",
          };
        } else {
          const deletedTask = tasks.splice(deleteIndex, 1)[0];
          result = {
            success: true,
            message: `Task "${deletedTask.title}" deleted successfully!`,
            task: deletedTask,
          };
        }
        break;

      case "response":
        result = {
          success: true,
          message:
            parsedResponse.data?.message ||
            parsedResponse.message ||
            "How can I help you with your tasks?",
        };
        break;

      default:
        result = {
          success: false,
          message: "I didn't understand that action. Please try again.",
        };
    }

    res.json(result);
  } catch (error) {
    console.error("AI Agent Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Sorry, I encountered an error while processing your request.",
      error: error.message,
    });
  }
});

// Rule-based message parser
function parseUserMessage(message) {
  // Check for task creation
  for (const pattern of taskPatterns.create) {
    const match = message.match(pattern);
    if (match) {
      return {
        action: "createTask",
        data: {
          title: match[1].trim(),
          dueDate: match[2] ? match[2].trim() : null,
          status: "Not Started",
        },
      };
    }
  }

  // Check for task listing
  for (const pattern of taskPatterns.list) {
    const match = message.match(pattern);
    if (match) {
      let filter = {};
      if (match[1]) {
        const filterText = match[1].toLowerCase();
        if (filterText.includes("completed") || filterText.includes("done")) {
          filter.status = "Completed";
        } else if (
          filterText.includes("pending") ||
          filterText.includes("incomplete")
        ) {
          filter.status = "Not Started";
        } else if (filterText.includes("today")) {
          filter.dueDate = getCurrentDate();
        }
      }
      return {
        action: "listTasks",
        data: filter,
      };
    }
  }

  // Check for task updates
  for (const pattern of taskPatterns.update) {
    const match = message.match(pattern);
    if (match) {
      const taskId = parseInt(match[1]);
      let status = match[2] ? match[2].trim() : "Completed";

      // Map common phrases to status
      if (
        status.includes("complete") ||
        status.includes("done") ||
        status.includes("finish")
      ) {
        status = "Completed";
      } else if (
        status.includes("progress") ||
        status.includes("working") ||
        status.includes("ongoing")
      ) {
        status = "In Progress";
      } else if (status.includes("not started") || status.includes("pending")) {
        status = "Not Started";
      }

      return {
        action: "updateTask",
        data: {
          id: taskId,
          status: status,
        },
      };
    }
  }

  // Check for task deletion
  for (const pattern of taskPatterns.delete) {
    const match = message.match(pattern);
    if (match) {
      if (match[1] && !isNaN(match[1])) {
        // Delete by ID
        return {
          action: "deleteTask",
          data: { id: parseInt(match[1]) },
        };
      } else if (match[1]) {
        // Delete by title (find task with matching title)
        const taskTitle = match[1].trim();
        const matchingTask = tasks.find((task) =>
          task.title.toLowerCase().includes(taskTitle.toLowerCase())
        );
        if (matchingTask) {
          return {
            action: "deleteTask",
            data: { id: matchingTask.id },
          };
        }
      }
    }
  }

  return null;
}

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", tasks: tasks.length });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
