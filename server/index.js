const express = require("express");
const mongoose = require('mongoose');
const cors = require("cors");
require('dotenv').config();
const bcrypt = require('bcrypt');
const path = require("path");
const multer = require('multer');

// models
const UsersModel = require("./models/Users"); // Import Users model
const PostModel = require("./models/Post");

const app = express();
app.use(express.json());
app.use(cors());

// Set up multer for handling file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Folder to save uploaded files
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname)); // File name with unique suffix
  }
});

const upload = multer({ storage: storage });

mongoose.connect("mongodb+srv://rachelaranjo:rachel123@cluster1.rr3or.mongodb.net/career");

mongoose.connection.on('error', (error) => {
  console.error('MongoDB connection error:', error);
});

mongoose.connection.once('open', () => {
  console.log('MongoDB connected successfully');
});


app.post('/register', async (req, res) => {
  const { firstName, lastName, username, email, password,role } = req.body;

  console.log('Registering new user with username:', username);

  if (!firstName || !lastName || !username || !email || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const existingUser = await UsersModel.findOne({ $or: [{ username }, { email }] });
  if (existingUser) {
    return res.status(400).json({ message: "Username or email already exists" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await UsersModel.create({
      firstName,
      lastName,
      username,
      email,
      password: hashedPassword,
      role,
      verified: false,
      subscriptionType: 'basic',
    });

    console.log('New user created:', newUser);
    
    // Return success flag and user info
    res.json({ success: true, user: newUser });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: "Error creating user", error: err.message });
  }
});


// Route for user login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;

  console.log('Login attempt for username:', username);

  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required" });
  }

  try {
    const user = await UsersModel.findOne({ username });

    if (!user) {
      return res.status(400).json({ message: "Invalid username or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid username or password" });
    }

    console.log('Login successful for username:', username);
    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal Server Error", error: err.message });
  }
});





// Route to fetch user data based on username
app.post('/userdata', async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ success: false, message: 'Username is required' });
    }

    // Find the user by username
    const user = await UsersModel.findOne({ username }).lean(); // Use .lean() for faster reads

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Respond with user data (you can modify the response to send more/less data as needed)
    res.json({ success: true, user: user });
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

// Route to update profile picture
app.post('/updateProfilePic', upload.single('profilePic'), async (req, res) => {
  if (!req.file || !req.file.path) {
    return res.status(400).json({ success: false, message: "No profile picture uploaded." });
  }

  const { username } = req.body;
  const profilePicUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

  try {
    const user = await UsersModel.findOneAndUpdate(
      { username },
      { pfp: profilePicUrl }, // Update the profile picture URL in the user's document
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Respond with the updated profile picture URL
    res.json({ success: true, message: "Profile picture updated successfully", profilePicUrl });
  } catch (error) {
    console.error("Error updating profile picture:", error);
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

app.post('/complete-profile', async (req, res) => {
  const {
    username,
    dob,
    location,
    role,
    companyName,
    contactNumber,
    skills,
    preferredJobType,
    subscription,
  } = req.body;

  console.log('Profile update request received:', req.body);

  // Validate username existence
  if (!username) {
    return res.status(400).json({ success: false, message: "Username is required" });
  }

  try {
    // Find the user by username
    const user = await UsersModel.findOne({ username });
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    console.log('User found:', user.username);

    // Prepare the fields to update
    const updatedFields = {};

    // Update only fields provided in the request
    if (dob) updatedFields.dob = dob;
    if (location) updatedFields.location = location;
    if (role) updatedFields.role = role;
    if (subscription) updatedFields.subscriptionType = subscription;
    if (skills) updatedFields.skills = skills;
    if (preferredJobType) updatedFields.preferredJobType = preferredJobType;
    if (companyName) updatedFields.companyName = companyName;
    if (contactNumber) updatedFields.contactNumber = contactNumber;

    // Perform the update
    const updatedUser = await UsersModel.findByIdAndUpdate(
      user._id,
      { $set: updatedFields },
      { new: true }
    );

    console.log('Profile updated successfully:', updatedUser);
    res.json({ success: true, message: "Profile updated successfully", user: updatedUser });
  } catch (error) {
    console.error('Error during profile update:', error);
    res.status(500).json({ success: false, message: "Error completing profile", error: error.message });
  }
});




// Payment API
app.post("/payment", async (req, res) => {
  const { username, cardNumber, expiryDate, cvv } = req.body;

  try {
    const user = await UsersModel.findOne({ username });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Simulate payment processing (e.g., check card details, etc.)
    if (
      user.cardDetails.cardNumber === cardNumber &&
      user.cardDetails.expiryDate === expiryDate &&
      user.cardDetails.cvv === cvv
    ) {
      return res.status(200).json({ success: true, message: "Payment successful" });
    } else {
      return res.status(400).json({ success: false, message: "Invalid card details" });
    }
  } catch (error) {
    console.error("Error during payment processing:", error);
    return res.status(500).json({ success: false, message: "Payment failed" });
  }
});

// Wallet payment endpoint
app.post("/wallet-payment", async (req, res) => {
  const { username, amount } = req.body;

  // Validate the request body
  if (!username || !amount) {
    return res.status(400).json({ success: false, message: "Missing username or amount" });
  }

  try {
    // Find the user by username
    const user = await UsersModel.findOne({ username });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Check if the user has enough wallet balance
    if (user.wallet.balance >= amount) {
      // Deduct the amount from the wallet balance
      user.wallet.balance -= amount;

      // Save the updated user data
      await user.save();

      // Respond with success and the new balance
      return res.status(200).json({
        success: true,
        message: "Payment successful!",
        newBalance: user.wallet.balance,
      });
    } else {
      return res.status(400).json({ success: false, message: "Insufficient wallet balance" });
    }
  } catch (error) {
    console.error("Error processing wallet payment:", error.message);
    return res.status(500).json({ success: false, message: "An error occurred during payment", error: error.message });
  }
});

// Backend - Express route to save personality type
app.post("/api/savePersonalityType", async (req, res) => {
  const { username, personalityType } = req.body;

  try {
    const user = await UsersModel.findOne({ username });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Update the user's personality type
    user.personalityType = personalityType;
    await user.save();

    return res.status(200).json({ success: true, message: "Personality type saved successfully" });
  } catch (error) {
    console.error("Error saving personality type:", error);
    return res.status(500).json({ success: false, message: "Failed to save personality type" });
  }
});

app.post("/posts", upload.single("companyLogo"), async (req, res) => {
  try {
    const {
      title,
      location,
      jobType,
      description,
      requirements,
      skills,
      companyName,
      salaryMin,
      salaryMax,
      applicationDeadline,
    } = req.body;

    // Retrieve employer's username from headers
    const username = req.headers.username; // Ensure this is being sent correctly from the client

    // Validate the username
    if (!username) {
      return res.status(400).json({ success: false, message: "Username is required" });
    }

    // Find the employer in the UsersModel
    const employer = await UsersModel.findOne({ username, role: "employer" });
    if (!employer) {
      return res.status(404).json({ success: false, message: "Employer not found" });
    }

    // Handle file upload for company logo
    const companyLogoUrl = req.file
      ? `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`
      : null;

    // Create the post
    const newPost = await PostModel.create({
      title,
      location,
      jobType,
      description,
      requirements: Array.isArray(requirements) ? requirements : [requirements],
      skills: Array.isArray(skills) ? skills : [skills],
      companyName,
      companyLogo: companyLogoUrl,
      salaryRange: { min: salaryMin, max: salaryMax },
      applicationDeadline,
      postedBy: employer._id, // Reference the employer
    });

    // Optionally update the employer's profile with the new post reference
    await UsersModel.findByIdAndUpdate(employer._id, { $push: { posts: newPost._id } });

    res.status(201).json({ success: true, post: newPost });
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
  }
});

app.delete("/posts/:id", async (req, res) => {
  try {
    const postId = req.params.id;
    await PostModel.findByIdAndDelete(postId);
    res.json({ success: true, message: "Post deleted successfully" });
  } catch (err) {
    console.error("Error deleting post:", err);
    res.status(500).json({ success: false, message: "Failed to delete post" });
  }
});





app.post("/employer-posts", async (req, res) => {
  try {
    const { username } = req.body;

    if (!username) {
      console.log("No username provided in request.");
      return res.status(400).json({ success: false, message: "Username is required" });
    }

    // Find the user by username using the correct model name
    const user = await UsersModel.findOne({ username });

    if (!user) {
      console.log(`No user found for username: ${username}`);
      return res.status(404).json({ success: false, message: "User not found" });
    }

    console.log(`Found user: ${username}, ObjectId: ${user._id}`);

    // Use the user's `_id` to fetch posts
    const employerPosts = await PostModel.find({ postedBy: user._id }).sort({ createdAt: -1 });

    if (employerPosts.length === 0) {
      console.log(`No posts found for ObjectId: ${user._id}`);
    } else {
      console.log(`Posts found for ObjectId: ${user._id}`, employerPosts);
    }

    res.status(200).json({ success: true, posts: employerPosts });
  } catch (error) {
    console.error("Error fetching employer posts:", error);
    res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
  }
});

// Fetch all users for the admin
app.get('/api/users', async (req, res) => {
  try {
    const users = await UsersModel.find(); // Adjust to include necessary fields as per your schema
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Failed to fetch users" });
  }
});


app.get('/api/users/:username', (req, res) => {
  const { username } = req.params;
  UsersModel.findOne({ username })
    .then(user => {
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json(user);
    })
    .catch(err => res.status(500).json({ message: 'Server error', error: err }));
});

app.get("/all-jobs", async (req, res) => {
  const { username } = req.query;

  if (!username) {
    return res.status(400).json({ success: false, message: "Username is required" });
  }

  try {
    const user = await UsersModel.findOne({ username });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Extract job IDs the user has swiped on
    const swipedJobIds = user.swipes.map((swipe) => swipe.jobId.toString());

    // Fetch jobs that the user hasn't swiped on
    const jobs = await PostModel.find({ _id: { $nin: swipedJobIds } });

    if (jobs.length === 0) {
      return res.status(200).json({ success: true, jobs: [] });
    }

    res.status(200).json({ success: true, jobs });
  } catch (error) {
    console.error("Error fetching jobs:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});


app.post("/swipe", async (req, res) => {
  try {
    const { username, jobId, status } = req.body;

    if (!username || !jobId || !status) {
      return res.status(400).json({ success: false, message: "Missing data" });
    }

    const user = await UsersModel.findOne({ username });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const existingSwipe = user.swipes.find((swipe) => swipe.jobId.toString() === jobId);

if (existingSwipe) {
  existingSwipe.status = status;
  await user.save();
  return res
    .status(200)
    .json({ success: true, message: "Swipe status updated" });
}

// Save the new swipe
user.swipes.push({ jobId, status });
await user.save();

res.status(200).json({ success: true, message: "Swipe recorded" });

  } catch (error) {
    console.error("Error saving swipe:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.get("/user-skills", async (req, res) => {
  const { username } = req.query;

  if (!username) {
    return res.status(400).json({ success: false, message: "Username is required" });
  }

  try {
    const user = await UsersModel.findOne({ username });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({ success: true, skills: user.skills || [] });
  } catch (error) {
    console.error("Error fetching user skills:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.get("/matched-job-seekers", async (req, res) => {
  const { username } = req.query;

  if (!username) {
    return res.status(400).json({ success: false, message: "Username is required" });
  }

  try {
    const employer = await UsersModel.findOne({ username, role: "employer" });
    if (!employer) {
      return res.status(404).json({ success: false, message: "Employer not found" });
    }

    const employerPosts = await PostModel.find({ postedBy: employer._id });
    const postIds = employerPosts.map((post) => post._id.toString());

    const matchedJobSeekers = await UsersModel.find({
      role: "job_seeker",
      swipes: {
        $elemMatch: { jobId: { $in: postIds }, status: "yes", employerStatus: { $ne: "Rejected" } },
      },
    })
      .select("username firstName lastName email skills preferredJobType swipes")
      .lean();

    // Attach postId to each matched job seeker
    const matchedJobSeekersWithPostId = matchedJobSeekers.map((seeker) => {
      const matchedSwipe = seeker.swipes.find(
        (swipe) => postIds.includes(swipe.jobId.toString()) && swipe.employerStatus !== "Rejected"
      );
      return {
        ...seeker,
        postId: matchedSwipe ? matchedSwipe.jobId : null,
      };
    });

    console.log("Matched Job Seekers With Post ID:", matchedJobSeekersWithPostId);

    res.status(200).json({
      success: true,
      matchedJobSeekers: matchedJobSeekersWithPostId,
    });
  } catch (error) {
    console.error("Error fetching matched job seekers:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.post("/process-decision", async (req, res) => {
  try {
    const { employerUsername, seekerUsername, postId, decision } = req.body;

    // Validate required fields
    if (!employerUsername || !seekerUsername || !postId || !decision) {
      console.error("Missing required fields:", { employerUsername, seekerUsername, postId, decision });
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    // Fetch employer to validate their existence
    const employer = await UsersModel.findOne({ username: employerUsername, role: "employer" });
    if (!employer) {
      console.error("Employer not found for username:", employerUsername);
      return res.status(404).json({ success: false, message: "Employer not found" });
    }

    // Fetch seeker to update their swipe status
    const seeker = await UsersModel.findOne({ username: seekerUsername, role: "job_seeker" });
    if (!seeker) {
      console.error("Seeker not found for username:", seekerUsername);
      return res.status(404).json({ success: false, message: "Job seeker not found" });
    }

    // Update the specific swipe status in the seeker's document
    const swipe = seeker.swipes.find((swipe) => swipe.jobId.toString() === postId);
    if (!swipe) {
      console.error("Swipe not found for the given postId in seeker's record");
      return res.status(404).json({ success: false, message: "Swipe record not found" });
    }

    // Update employerStatus based on decision
    swipe.employerStatus = decision === "yes" ? "Accepted" : "Rejected";

    // Save the updated seeker document
    await seeker.save();

    // Respond to the client
    res.status(200).json({
      success: true,
      message: decision === "yes" ? "Candidate accepted" : "Candidate rejected",
    });
  } catch (error) {
    console.error("Error processing decision:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

app.post("/saveCv", (req, res) => {
  const { username, pdfData } = req.body;

  UsersModel.findOneAndUpdate(
    { username },
    { $set: { pdfData } }, // Update or add the PDF data
    { new: true }
  )
    .then((user) => {
      if (user) {
        res.json({ success: true, message: "CV saved successfully." });
      } else {
        res.json({ success: false, message: "User not found." });
      }
    })
    .catch((err) => {
      console.error("Error saving CV:", err);
      res.json({ success: false, message: "An error occurred." });
    });
});


app.post('/uploadDocument', upload.single('document'), async (req, res) => {
  if (!req.file || !req.file.path) {
    return res.status(400).json({ success: false, message: "No document uploaded." });
  }

  const { username } = req.body;
  const documentUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

  try {
    // Assuming you have a UsersModel where you store the documents for each user
    const user = await UsersModel.findOneAndUpdate(
      { username },
      { $set: { documents: documentUrl } }, // Set the document URL as a single string, not an array
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Respond with the updated document URL (if needed)
    res.json({
      success: true,
      message: "Document uploaded successfully",
      documentUrl,
    });
  } catch (error) {
    console.error("Error uploading document:", error);
    res.status(500).json({ error: "Internal Server Error", details: error.message });
  }
});

// Route to verify user
app.post("/api/users/verify", async (req, res) => {
  try {
    const { username } = req.body;

    // Find the user and update their verified status
    const updatedUser = await UsersModel.findOneAndUpdate(
      { username },
      { verified: true },
      { new: true } // Return the updated document
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("Error verifying user:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Route to verify user
app.post("/api/users/reject", async (req, res) => {
  try {
    const { username } = req.body;

    // Find the user and update their verified status
    const updatedUser = await UsersModel.findOneAndUpdate(
      { username },
      { verified: false },
      { new: true } // Return the updated document
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("Error rejecting user:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Serve static files (uploaded images)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// Server Listening
app.listen(3001, () => {
  console.log("Server is running on port 3001");
});